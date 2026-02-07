package messages

import (
	"fmt"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/asn1tools"
	"github.com/jcmturner/gokrb5/v8/crypto"
	"github.com/jcmturner/gokrb5/v8/iana"
	"github.com/jcmturner/gokrb5/v8/iana/asnAppTag"
	"github.com/jcmturner/gokrb5/v8/iana/keyusage"
	"github.com/jcmturner/gokrb5/v8/iana/msgtype"
	"github.com/jcmturner/gokrb5/v8/krberror"
	"github.com/jcmturner/gokrb5/v8/types"
)

// KRBPriv implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.7.1.
type KRBPriv struct {
	PVNO             int                 `asn1:"explicit,tag:0"`
	MsgType          int                 `asn1:"explicit,tag:1"`
	EncPart          types.EncryptedData `asn1:"explicit,tag:3"`
	DecryptedEncPart EncKrbPrivPart      `asn1:"optional,omitempty"` // Not part of ASN1 bytes so marked as optional so unmarshalling works
}

// EncKrbPrivPart is the encrypted part of KRB_PRIV.
type EncKrbPrivPart struct {
	UserData       []byte            `asn1:"explicit,tag:0"`
	Timestamp      time.Time         `asn1:"generalized,optional,explicit,tag:1"`
	Usec           int               `asn1:"optional,explicit,tag:2"`
	SequenceNumber int64             `asn1:"optional,explicit,tag:3"`
	SAddress       types.HostAddress `asn1:"explicit,tag:4"`
	RAddress       types.HostAddress `asn1:"optional,explicit,tag:5"`
}

// NewKRBPriv returns a new KRBPriv type.
func NewKRBPriv(part EncKrbPrivPart) KRBPriv {
	return KRBPriv{
		PVNO:             iana.PVNO,
		MsgType:          msgtype.KRB_PRIV,
		DecryptedEncPart: part,
	}
}

// Unmarshal bytes b into the KRBPriv struct.
func (k *KRBPriv) Unmarshal(b []byte) error {
	_, err := asn1.UnmarshalWithParams(b, k, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.KRBPriv))
	if err != nil {
		return processUnmarshalReplyError(b, err)
	}
	expectedMsgType := msgtype.KRB_PRIV
	if k.MsgType != expectedMsgType {
		return krberror.NewErrorf(krberror.KRBMsgError, "message ID does not indicate a KRB_PRIV. Expected: %v; Actual: %v", expectedMsgType, k.MsgType)
	}
	return nil
}

// Unmarshal bytes b into the EncKrbPrivPart struct.
func (k *EncKrbPrivPart) Unmarshal(b []byte) error {
	_, err := asn1.UnmarshalWithParams(b, k, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.EncKrbPrivPart))
	if err != nil {
		return krberror.Errorf(err, krberror.EncodingError, "KRB_PRIV unmarshal error")
	}
	return nil
}

// Marshal the KRBPriv.
func (k *KRBPriv) Marshal() ([]byte, error) {
	tk := KRBPriv{
		PVNO:    k.PVNO,
		MsgType: k.MsgType,
		EncPart: k.EncPart,
	}
	b, err := asn1.Marshal(tk)
	if err != nil {
		return []byte{}, err
	}
	b = asn1tools.AddASNAppTag(b, asnAppTag.KRBPriv)
	return b, nil
}

// EncryptEncPart encrypts the DecryptedEncPart within the KRBPriv.
// Use to prepare for marshaling.
func (k *KRBPriv) EncryptEncPart(key types.EncryptionKey) error {
	b, err := asn1.Marshal(k.DecryptedEncPart)
	if err != nil {
		return err
	}
	b = asn1tools.AddASNAppTag(b, asnAppTag.EncKrbPrivPart)
	k.EncPart, err = crypto.GetEncryptedData(b, key, keyusage.KRB_PRIV_ENCPART, 1)
	if err != nil {
		return err
	}
	return nil
}

// DecryptEncPart decrypts the encrypted part of the KRBPriv message.
func (k *KRBPriv) DecryptEncPart(key types.EncryptionKey) error {
	b, err := crypto.DecryptEncPart(k.EncPart, key, keyusage.KRB_PRIV_ENCPART)
	if err != nil {
		return fmt.Errorf("error decrypting KRBPriv EncPart: %v", err)
	}
	err = k.DecryptedEncPart.Unmarshal(b)
	if err != nil {
		return fmt.Errorf("error unmarshaling encrypted part: %v", err)
	}
	return nil
}
