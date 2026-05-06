package pgproto3

import (
	"encoding/binary"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/internal/pgio"
)

// AuthenticationSASLContinue is a message sent from the backend containing a SASL challenge.
type AuthenticationSASLContinue struct {
	Data []byte
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*AuthenticationSASLContinue) Backend() {}

// Backend identifies this message as an authentication response.
func (*AuthenticationSASLContinue) AuthenticationResponse() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *AuthenticationSASLContinue) Decode(src []byte) error {
	if len(src) < 4 {
		return errors.New("authentication message too short")
	}

	authType := binary.BigEndian.Uint32(src)

	if authType != AuthTypeSASLContinue {
		return errors.New("bad auth type")
	}

	dst.Data = src[4:]

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *AuthenticationSASLContinue) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'R')
	dst = pgio.AppendUint32(dst, AuthTypeSASLContinue)
	dst = append(dst, src.Data...)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src AuthenticationSASLContinue) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
		Data string
	}{
		Type: "AuthenticationSASLContinue",
		Data: string(src.Data),
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (dst *AuthenticationSASLContinue) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		Data string
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}

	dst.Data = []byte(msg.Data)
	return nil
}
