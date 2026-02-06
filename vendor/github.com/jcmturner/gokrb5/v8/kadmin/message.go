package kadmin

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"math"

	"github.com/jcmturner/gokrb5/v8/messages"
	"github.com/jcmturner/gokrb5/v8/types"
)

const (
	verisonHex = "ff80"
)

// Request message for changing password.
type Request struct {
	APREQ   messages.APReq
	KRBPriv messages.KRBPriv
}

// Reply message for a password change.
type Reply struct {
	MessageLength int
	Version       int
	APREPLength   int
	APREP         messages.APRep
	KRBPriv       messages.KRBPriv
	KRBError      messages.KRBError
	IsKRBError    bool
	ResultCode    uint16
	Result        string
}

// Marshal a Request into a byte slice.
func (m *Request) Marshal() (b []byte, err error) {
	b = []byte{255, 128} // protocol version number: contains the hex constant 0xff80 (big-endian integer).
	ab, e := m.APREQ.Marshal()
	if e != nil {
		err = fmt.Errorf("error marshaling AP_REQ: %v", e)
		return
	}
	if len(ab) > math.MaxUint16 {
		err = errors.New("length of AP_REQ greater then max Uint16 size")
		return
	}
	al := make([]byte, 2)
	binary.BigEndian.PutUint16(al, uint16(len(ab)))
	b = append(b, al...)
	b = append(b, ab...)
	pb, e := m.KRBPriv.Marshal()
	if e != nil {
		err = fmt.Errorf("error marshaling KRB_Priv: %v", e)
		return
	}
	b = append(b, pb...)
	if len(b)+2 > math.MaxUint16 {
		err = errors.New("length of message greater then max Uint16 size")
		return
	}
	ml := make([]byte, 2)
	binary.BigEndian.PutUint16(ml, uint16(len(b)+2))
	b = append(ml, b...)
	return
}

// Unmarshal a byte slice into a Reply.
func (m *Reply) Unmarshal(b []byte) error {
	m.MessageLength = int(binary.BigEndian.Uint16(b[0:2]))
	m.Version = int(binary.BigEndian.Uint16(b[2:4]))
	if m.Version != 1 {
		return fmt.Errorf("kadmin reply has incorrect protocol version number: %d", m.Version)
	}
	m.APREPLength = int(binary.BigEndian.Uint16(b[4:6]))
	if m.APREPLength != 0 {
		err := m.APREP.Unmarshal(b[6 : 6+m.APREPLength])
		if err != nil {
			return err
		}
		err = m.KRBPriv.Unmarshal(b[6+m.APREPLength : m.MessageLength])
		if err != nil {
			return err
		}
	} else {
		m.IsKRBError = true
		m.KRBError.Unmarshal(b[6:m.MessageLength])
		m.ResultCode, m.Result = parseResponse(m.KRBError.EData)
	}
	return nil
}

func parseResponse(b []byte) (c uint16, s string) {
	c = binary.BigEndian.Uint16(b[0:2])
	buf := bytes.NewBuffer(b[2:])
	m := make([]byte, len(b)-2)
	binary.Read(buf, binary.BigEndian, &m)
	s = string(m)
	return
}

// Decrypt the encrypted part of the KRBError within the change password Reply.
func (m *Reply) Decrypt(key types.EncryptionKey) error {
	if m.IsKRBError {
		return m.KRBError
	}
	err := m.KRBPriv.DecryptEncPart(key)
	if err != nil {
		return err
	}
	m.ResultCode, m.Result = parseResponse(m.KRBPriv.DecryptedEncPart.UserData)
	return nil
}
