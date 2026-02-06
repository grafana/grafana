package pgproto3

import (
	"encoding/binary"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type AuthenticationGSS struct{}

func (a *AuthenticationGSS) Backend() {}

func (a *AuthenticationGSS) AuthenticationResponse() {}

func (a *AuthenticationGSS) Decode(src []byte) error {
	if len(src) < 4 {
		return errors.New("authentication message too short")
	}

	authType := binary.BigEndian.Uint32(src)

	if authType != AuthTypeGSS {
		return errors.New("bad auth type")
	}
	return nil
}

func (a *AuthenticationGSS) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'R')
	dst = pgio.AppendUint32(dst, AuthTypeGSS)
	return finishMessage(dst, sp)
}

func (a *AuthenticationGSS) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
		Data []byte
	}{
		Type: "AuthenticationGSS",
	})
}

func (a *AuthenticationGSS) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		Type string
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}
	return nil
}
