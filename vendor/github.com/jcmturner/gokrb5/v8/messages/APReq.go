package messages

import (
	"fmt"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/asn1tools"
	"github.com/jcmturner/gokrb5/v8/crypto"
	"github.com/jcmturner/gokrb5/v8/iana"
	"github.com/jcmturner/gokrb5/v8/iana/asnAppTag"
	"github.com/jcmturner/gokrb5/v8/iana/errorcode"
	"github.com/jcmturner/gokrb5/v8/iana/keyusage"
	"github.com/jcmturner/gokrb5/v8/iana/msgtype"
	"github.com/jcmturner/gokrb5/v8/keytab"
	"github.com/jcmturner/gokrb5/v8/krberror"
	"github.com/jcmturner/gokrb5/v8/types"
)

type marshalAPReq struct {
	PVNO      int            `asn1:"explicit,tag:0"`
	MsgType   int            `asn1:"explicit,tag:1"`
	APOptions asn1.BitString `asn1:"explicit,tag:2"`
	// Ticket needs to be a raw value as it is wrapped in an APPLICATION tag
	Ticket                 asn1.RawValue       `asn1:"explicit,tag:3"`
	EncryptedAuthenticator types.EncryptedData `asn1:"explicit,tag:4"`
}

// APReq implements RFC 4120 KRB_AP_REQ: https://tools.ietf.org/html/rfc4120#section-5.5.1.
type APReq struct {
	PVNO                   int                 `asn1:"explicit,tag:0"`
	MsgType                int                 `asn1:"explicit,tag:1"`
	APOptions              asn1.BitString      `asn1:"explicit,tag:2"`
	Ticket                 Ticket              `asn1:"explicit,tag:3"`
	EncryptedAuthenticator types.EncryptedData `asn1:"explicit,tag:4"`
	Authenticator          types.Authenticator `asn1:"optional"`
}

// NewAPReq generates a new KRB_AP_REQ struct.
func NewAPReq(tkt Ticket, sessionKey types.EncryptionKey, auth types.Authenticator) (APReq, error) {
	var a APReq
	ed, err := encryptAuthenticator(auth, sessionKey, tkt)
	if err != nil {
		return a, krberror.Errorf(err, krberror.KRBMsgError, "error creating Authenticator for AP_REQ")
	}
	a = APReq{
		PVNO:                   iana.PVNO,
		MsgType:                msgtype.KRB_AP_REQ,
		APOptions:              types.NewKrbFlags(),
		Ticket:                 tkt,
		EncryptedAuthenticator: ed,
	}
	return a, nil
}

// Encrypt Authenticator
func encryptAuthenticator(a types.Authenticator, sessionKey types.EncryptionKey, tkt Ticket) (types.EncryptedData, error) {
	var ed types.EncryptedData
	m, err := a.Marshal()
	if err != nil {
		return ed, krberror.Errorf(err, krberror.EncodingError, "marshaling error of EncryptedData form of Authenticator")
	}
	usage := authenticatorKeyUsage(tkt.SName)
	ed, err = crypto.GetEncryptedData(m, sessionKey, uint32(usage), tkt.EncPart.KVNO)
	if err != nil {
		return ed, krberror.Errorf(err, krberror.EncryptingError, "error encrypting Authenticator")
	}
	return ed, nil
}

// DecryptAuthenticator decrypts the Authenticator within the AP_REQ.
// sessionKey may simply be the key within the decrypted EncPart of the ticket within the AP_REQ.
func (a *APReq) DecryptAuthenticator(sessionKey types.EncryptionKey) error {
	usage := authenticatorKeyUsage(a.Ticket.SName)
	ab, e := crypto.DecryptEncPart(a.EncryptedAuthenticator, sessionKey, uint32(usage))
	if e != nil {
		return fmt.Errorf("error decrypting authenticator: %v", e)
	}
	err := a.Authenticator.Unmarshal(ab)
	if err != nil {
		return fmt.Errorf("error unmarshaling authenticator: %v", err)
	}
	return nil
}

func authenticatorKeyUsage(pn types.PrincipalName) int {
	if pn.NameString[0] == "krbtgt" {
		return keyusage.TGS_REQ_PA_TGS_REQ_AP_REQ_AUTHENTICATOR
	}
	return keyusage.AP_REQ_AUTHENTICATOR
}

// Unmarshal bytes b into the APReq struct.
func (a *APReq) Unmarshal(b []byte) error {
	var m marshalAPReq
	_, err := asn1.UnmarshalWithParams(b, &m, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.APREQ))
	if err != nil {
		return krberror.Errorf(err, krberror.EncodingError, "unmarshal error of AP_REQ")
	}
	if m.MsgType != msgtype.KRB_AP_REQ {
		return NewKRBError(types.PrincipalName{}, "", errorcode.KRB_AP_ERR_MSG_TYPE, errorcode.Lookup(errorcode.KRB_AP_ERR_MSG_TYPE))
	}
	a.PVNO = m.PVNO
	a.MsgType = m.MsgType
	a.APOptions = m.APOptions
	a.EncryptedAuthenticator = m.EncryptedAuthenticator
	a.Ticket, err = unmarshalTicket(m.Ticket.Bytes)
	if err != nil {
		return krberror.Errorf(err, krberror.EncodingError, "unmarshaling error of Ticket within AP_REQ")
	}
	return nil
}

// Marshal APReq struct.
func (a *APReq) Marshal() ([]byte, error) {
	m := marshalAPReq{
		PVNO:                   a.PVNO,
		MsgType:                a.MsgType,
		APOptions:              a.APOptions,
		EncryptedAuthenticator: a.EncryptedAuthenticator,
	}
	var b []byte
	b, err := a.Ticket.Marshal()
	if err != nil {
		return b, err
	}
	m.Ticket = asn1.RawValue{
		Class:      asn1.ClassContextSpecific,
		IsCompound: true,
		Tag:        3,
		Bytes:      b,
	}
	mk, err := asn1.Marshal(m)
	if err != nil {
		return mk, krberror.Errorf(err, krberror.EncodingError, "marshaling error of AP_REQ")
	}
	mk = asn1tools.AddASNAppTag(mk, asnAppTag.APREQ)
	return mk, nil
}

// Verify an AP_REQ using service's keytab, spn and max acceptable clock skew duration.
// The service ticket encrypted part and authenticator will be decrypted as part of this operation.
func (a *APReq) Verify(kt *keytab.Keytab, d time.Duration, cAddr types.HostAddress, snameOverride *types.PrincipalName) (bool, error) {
	// Decrypt ticket's encrypted part with service key
	//TODO decrypt with service's session key from its TGT is use-to-user. Need to figure out how to get TGT.
	//if types.IsFlagSet(&a.APOptions, flags.APOptionUseSessionKey) {
	//	err := a.Ticket.Decrypt(tgt.DecryptedEncPart.Key)
	//	if err != nil {
	//		return false, krberror.Errorf(err, krberror.DecryptingError, "error decrypting encpart of ticket provided using session key")
	//	}
	//} else {
	//	err := a.Ticket.DecryptEncPart(*kt, &a.Ticket.SName)
	//	if err != nil {
	//		return false, krberror.Errorf(err, krberror.DecryptingError, "error decrypting encpart of service ticket provided")
	//	}
	//}
	sname := &a.Ticket.SName
	if snameOverride != nil {
		sname = snameOverride
	}
	err := a.Ticket.DecryptEncPart(kt, sname)
	if err != nil {
		return false, krberror.Errorf(err, krberror.DecryptingError, "error decrypting encpart of service ticket provided")
	}

	// Check time validity of ticket
	ok, err := a.Ticket.Valid(d)
	if err != nil || !ok {
		return ok, err
	}

	// Check client's address is listed in the client addresses in the ticket
	if len(a.Ticket.DecryptedEncPart.CAddr) > 0 {
		//If client addresses are present check if any of them match the source IP that sent the APReq
		//If there is no match return KRB_AP_ERR_BADADDR error.
		if !types.HostAddressesContains(a.Ticket.DecryptedEncPart.CAddr, cAddr) {
			return false, NewKRBError(a.Ticket.SName, a.Ticket.Realm, errorcode.KRB_AP_ERR_BADADDR, "client address not within the list contained in the service ticket")
		}
	}

	// Decrypt authenticator with session key from ticket's encrypted part
	err = a.DecryptAuthenticator(a.Ticket.DecryptedEncPart.Key)
	if err != nil {
		return false, NewKRBError(a.Ticket.SName, a.Ticket.Realm, errorcode.KRB_AP_ERR_BAD_INTEGRITY, "could not decrypt authenticator")
	}

	// Check CName in authenticator is the same as that in the ticket
	if !a.Authenticator.CName.Equal(a.Ticket.DecryptedEncPart.CName) {
		return false, NewKRBError(a.Ticket.SName, a.Ticket.Realm, errorcode.KRB_AP_ERR_BADMATCH, "CName in Authenticator does not match that in service ticket")
	}

	// Check the clock skew between the client and the service server
	ct := a.Authenticator.CTime.Add(time.Duration(a.Authenticator.Cusec) * time.Microsecond)
	t := time.Now().UTC()
	if t.Sub(ct) > d || ct.Sub(t) > d {
		return false, NewKRBError(a.Ticket.SName, a.Ticket.Realm, errorcode.KRB_AP_ERR_SKEW, fmt.Sprintf("clock skew with client too large. greater than %v seconds", d))
	}
	return true, nil
}
