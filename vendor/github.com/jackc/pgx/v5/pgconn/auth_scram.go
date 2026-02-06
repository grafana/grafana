// SCRAM-SHA-256 authentication
//
// Resources:
//   https://tools.ietf.org/html/rfc5802
//   https://tools.ietf.org/html/rfc8265
//   https://www.postgresql.org/docs/current/sasl-authentication.html
//
// Inspiration drawn from other implementations:
//   https://github.com/lib/pq/pull/608
//   https://github.com/lib/pq/pull/788
//   https://github.com/lib/pq/pull/833

package pgconn

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"

	"github.com/jackc/pgx/v5/pgproto3"
	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/text/secure/precis"
)

const clientNonceLen = 18

// Perform SCRAM authentication.
func (c *PgConn) scramAuth(serverAuthMechanisms []string) error {
	sc, err := newScramClient(serverAuthMechanisms, c.config.Password)
	if err != nil {
		return err
	}

	// Send client-first-message in a SASLInitialResponse
	saslInitialResponse := &pgproto3.SASLInitialResponse{
		AuthMechanism: "SCRAM-SHA-256",
		Data:          sc.clientFirstMessage(),
	}
	c.frontend.Send(saslInitialResponse)
	err = c.flushWithPotentialWriteReadDeadlock()
	if err != nil {
		return err
	}

	// Receive server-first-message payload in an AuthenticationSASLContinue.
	saslContinue, err := c.rxSASLContinue()
	if err != nil {
		return err
	}
	err = sc.recvServerFirstMessage(saslContinue.Data)
	if err != nil {
		return err
	}

	// Send client-final-message in a SASLResponse
	saslResponse := &pgproto3.SASLResponse{
		Data: []byte(sc.clientFinalMessage()),
	}
	c.frontend.Send(saslResponse)
	err = c.flushWithPotentialWriteReadDeadlock()
	if err != nil {
		return err
	}

	// Receive server-final-message payload in an AuthenticationSASLFinal.
	saslFinal, err := c.rxSASLFinal()
	if err != nil {
		return err
	}
	return sc.recvServerFinalMessage(saslFinal.Data)
}

func (c *PgConn) rxSASLContinue() (*pgproto3.AuthenticationSASLContinue, error) {
	msg, err := c.receiveMessage()
	if err != nil {
		return nil, err
	}
	switch m := msg.(type) {
	case *pgproto3.AuthenticationSASLContinue:
		return m, nil
	case *pgproto3.ErrorResponse:
		return nil, ErrorResponseToPgError(m)
	}

	return nil, fmt.Errorf("expected AuthenticationSASLContinue message but received unexpected message %T", msg)
}

func (c *PgConn) rxSASLFinal() (*pgproto3.AuthenticationSASLFinal, error) {
	msg, err := c.receiveMessage()
	if err != nil {
		return nil, err
	}
	switch m := msg.(type) {
	case *pgproto3.AuthenticationSASLFinal:
		return m, nil
	case *pgproto3.ErrorResponse:
		return nil, ErrorResponseToPgError(m)
	}

	return nil, fmt.Errorf("expected AuthenticationSASLFinal message but received unexpected message %T", msg)
}

type scramClient struct {
	serverAuthMechanisms []string
	password             []byte
	clientNonce          []byte

	clientFirstMessageBare []byte

	serverFirstMessage   []byte
	clientAndServerNonce []byte
	salt                 []byte
	iterations           int

	saltedPassword []byte
	authMessage    []byte
}

func newScramClient(serverAuthMechanisms []string, password string) (*scramClient, error) {
	sc := &scramClient{
		serverAuthMechanisms: serverAuthMechanisms,
	}

	// Ensure server supports SCRAM-SHA-256
	hasScramSHA256 := false
	for _, mech := range sc.serverAuthMechanisms {
		if mech == "SCRAM-SHA-256" {
			hasScramSHA256 = true
			break
		}
	}
	if !hasScramSHA256 {
		return nil, errors.New("server does not support SCRAM-SHA-256")
	}

	// precis.OpaqueString is equivalent to SASLprep for password.
	var err error
	sc.password, err = precis.OpaqueString.Bytes([]byte(password))
	if err != nil {
		// PostgreSQL allows passwords invalid according to SCRAM / SASLprep.
		sc.password = []byte(password)
	}

	buf := make([]byte, clientNonceLen)
	_, err = rand.Read(buf)
	if err != nil {
		return nil, err
	}
	sc.clientNonce = make([]byte, base64.RawStdEncoding.EncodedLen(len(buf)))
	base64.RawStdEncoding.Encode(sc.clientNonce, buf)

	return sc, nil
}

func (sc *scramClient) clientFirstMessage() []byte {
	sc.clientFirstMessageBare = []byte(fmt.Sprintf("n=,r=%s", sc.clientNonce))
	return []byte(fmt.Sprintf("n,,%s", sc.clientFirstMessageBare))
}

func (sc *scramClient) recvServerFirstMessage(serverFirstMessage []byte) error {
	sc.serverFirstMessage = serverFirstMessage
	buf := serverFirstMessage
	if !bytes.HasPrefix(buf, []byte("r=")) {
		return errors.New("invalid SCRAM server-first-message received from server: did not include r=")
	}
	buf = buf[2:]

	idx := bytes.IndexByte(buf, ',')
	if idx == -1 {
		return errors.New("invalid SCRAM server-first-message received from server: did not include s=")
	}
	sc.clientAndServerNonce = buf[:idx]
	buf = buf[idx+1:]

	if !bytes.HasPrefix(buf, []byte("s=")) {
		return errors.New("invalid SCRAM server-first-message received from server: did not include s=")
	}
	buf = buf[2:]

	idx = bytes.IndexByte(buf, ',')
	if idx == -1 {
		return errors.New("invalid SCRAM server-first-message received from server: did not include i=")
	}
	saltStr := buf[:idx]
	buf = buf[idx+1:]

	if !bytes.HasPrefix(buf, []byte("i=")) {
		return errors.New("invalid SCRAM server-first-message received from server: did not include i=")
	}
	buf = buf[2:]
	iterationsStr := buf

	var err error
	sc.salt, err = base64.StdEncoding.DecodeString(string(saltStr))
	if err != nil {
		return fmt.Errorf("invalid SCRAM salt received from server: %w", err)
	}

	sc.iterations, err = strconv.Atoi(string(iterationsStr))
	if err != nil || sc.iterations <= 0 {
		return fmt.Errorf("invalid SCRAM iteration count received from server: %w", err)
	}

	if !bytes.HasPrefix(sc.clientAndServerNonce, sc.clientNonce) {
		return errors.New("invalid SCRAM nonce: did not start with client nonce")
	}

	if len(sc.clientAndServerNonce) <= len(sc.clientNonce) {
		return errors.New("invalid SCRAM nonce: did not include server nonce")
	}

	return nil
}

func (sc *scramClient) clientFinalMessage() string {
	clientFinalMessageWithoutProof := []byte(fmt.Sprintf("c=biws,r=%s", sc.clientAndServerNonce))

	sc.saltedPassword = pbkdf2.Key([]byte(sc.password), sc.salt, sc.iterations, 32, sha256.New)
	sc.authMessage = bytes.Join([][]byte{sc.clientFirstMessageBare, sc.serverFirstMessage, clientFinalMessageWithoutProof}, []byte(","))

	clientProof := computeClientProof(sc.saltedPassword, sc.authMessage)

	return fmt.Sprintf("%s,p=%s", clientFinalMessageWithoutProof, clientProof)
}

func (sc *scramClient) recvServerFinalMessage(serverFinalMessage []byte) error {
	if !bytes.HasPrefix(serverFinalMessage, []byte("v=")) {
		return errors.New("invalid SCRAM server-final-message received from server")
	}

	serverSignature := serverFinalMessage[2:]

	if !hmac.Equal(serverSignature, computeServerSignature(sc.saltedPassword, sc.authMessage)) {
		return errors.New("invalid SCRAM ServerSignature received from server")
	}

	return nil
}

func computeHMAC(key, msg []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(msg)
	return mac.Sum(nil)
}

func computeClientProof(saltedPassword, authMessage []byte) []byte {
	clientKey := computeHMAC(saltedPassword, []byte("Client Key"))
	storedKey := sha256.Sum256(clientKey)
	clientSignature := computeHMAC(storedKey[:], authMessage)

	clientProof := make([]byte, len(clientSignature))
	for i := 0; i < len(clientSignature); i++ {
		clientProof[i] = clientKey[i] ^ clientSignature[i]
	}

	buf := make([]byte, base64.StdEncoding.EncodedLen(len(clientProof)))
	base64.StdEncoding.Encode(buf, clientProof)
	return buf
}

func computeServerSignature(saltedPassword, authMessage []byte) []byte {
	serverKey := computeHMAC(saltedPassword, []byte("Server Key"))
	serverSignature := computeHMAC(serverKey, authMessage)
	buf := make([]byte, base64.StdEncoding.EncodedLen(len(serverSignature)))
	base64.StdEncoding.Encode(buf, serverSignature)
	return buf
}
