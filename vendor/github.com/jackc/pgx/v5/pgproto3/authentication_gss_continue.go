package pgproto3

import (
	"encoding/binary"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type AuthenticationGSSContinue struct {
	Data []byte
}

func (a *AuthenticationGSSContinue) Backend() {}

func (a *AuthenticationGSSContinue) AuthenticationResponse() {}

func (a *AuthenticationGSSContinue) Decode(src []byte) error {
	if len(src) < 4 {
		return errors.New("authentication message too short")
	}

	authType := binary.BigEndian.Uint32(src)

	if authType != AuthTypeGSSCont {
		return errors.New("bad auth type")
	}

	a.Data = src[4:]
	return nil
}

func (a *AuthenticationGSSContinue) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'R')
	dst = pgio.AppendUint32(dst, AuthTypeGSSCont)
	dst = append(dst, a.Data...)
	return finishMessage(dst, sp)
}

func (a *AuthenticationGSSContinue) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
		Data []byte
	}{
		Type: "AuthenticationGSSContinue",
		Data: a.Data,
	})
}

func (a *AuthenticationGSSContinue) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		Type string
		Data []byte
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}

	a.Data = msg.Data
	return nil
}
