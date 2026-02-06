package messages

// Reference: https://www.ietf.org/rfc/rfc4120.txt
// Section: 5.4.2

import (
	"fmt"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/asn1tools"
	"github.com/jcmturner/gokrb5/v8/config"
	"github.com/jcmturner/gokrb5/v8/credentials"
	"github.com/jcmturner/gokrb5/v8/crypto"
	"github.com/jcmturner/gokrb5/v8/iana/asnAppTag"
	"github.com/jcmturner/gokrb5/v8/iana/flags"
	"github.com/jcmturner/gokrb5/v8/iana/keyusage"
	"github.com/jcmturner/gokrb5/v8/iana/msgtype"
	"github.com/jcmturner/gokrb5/v8/iana/patype"
	"github.com/jcmturner/gokrb5/v8/krberror"
	"github.com/jcmturner/gokrb5/v8/types"
)

type marshalKDCRep struct {
	PVNO    int                  `asn1:"explicit,tag:0"`
	MsgType int                  `asn1:"explicit,tag:1"`
	PAData  types.PADataSequence `asn1:"explicit,optional,tag:2"`
	CRealm  string               `asn1:"generalstring,explicit,tag:3"`
	CName   types.PrincipalName  `asn1:"explicit,tag:4"`
	// Ticket needs to be a raw value as it is wrapped in an APPLICATION tag
	Ticket  asn1.RawValue       `asn1:"explicit,tag:5"`
	EncPart types.EncryptedData `asn1:"explicit,tag:6"`
}

// KDCRepFields represents the KRB_KDC_REP fields.
type KDCRepFields struct {
	PVNO             int
	MsgType          int
	PAData           []types.PAData
	CRealm           string
	CName            types.PrincipalName
	Ticket           Ticket
	EncPart          types.EncryptedData
	DecryptedEncPart EncKDCRepPart
}

// ASRep implements RFC 4120 KRB_AS_REP: https://tools.ietf.org/html/rfc4120#section-5.4.2.
type ASRep struct {
	KDCRepFields
}

// TGSRep implements RFC 4120 KRB_TGS_REP: https://tools.ietf.org/html/rfc4120#section-5.4.2.
type TGSRep struct {
	KDCRepFields
}

// EncKDCRepPart is the encrypted part of KRB_KDC_REP.
type EncKDCRepPart struct {
	Key           types.EncryptionKey  `asn1:"explicit,tag:0"`
	LastReqs      []LastReq            `asn1:"explicit,tag:1"`
	Nonce         int                  `asn1:"explicit,tag:2"`
	KeyExpiration time.Time            `asn1:"generalized,explicit,optional,tag:3"`
	Flags         asn1.BitString       `asn1:"explicit,tag:4"`
	AuthTime      time.Time            `asn1:"generalized,explicit,tag:5"`
	StartTime     time.Time            `asn1:"generalized,explicit,optional,tag:6"`
	EndTime       time.Time            `asn1:"generalized,explicit,tag:7"`
	RenewTill     time.Time            `asn1:"generalized,explicit,optional,tag:8"`
	SRealm        string               `asn1:"generalstring,explicit,tag:9"`
	SName         types.PrincipalName  `asn1:"explicit,tag:10"`
	CAddr         []types.HostAddress  `asn1:"explicit,optional,tag:11"`
	EncPAData     types.PADataSequence `asn1:"explicit,optional,tag:12"`
}

// LastReq part of KRB_KDC_REP.
type LastReq struct {
	LRType  int32     `asn1:"explicit,tag:0"`
	LRValue time.Time `asn1:"generalized,explicit,tag:1"`
}

// Unmarshal bytes b into the ASRep struct.
func (k *ASRep) Unmarshal(b []byte) error {
	var m marshalKDCRep
	_, err := asn1.UnmarshalWithParams(b, &m, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.ASREP))
	if err != nil {
		return processUnmarshalReplyError(b, err)
	}
	if m.MsgType != msgtype.KRB_AS_REP {
		return krberror.NewErrorf(krberror.KRBMsgError, "message ID does not indicate an AS_REP. Expected: %v; Actual: %v", msgtype.KRB_AS_REP, m.MsgType)
	}
	//Process the raw ticket within
	tkt, err := unmarshalTicket(m.Ticket.Bytes)
	if err != nil {
		return krberror.Errorf(err, krberror.EncodingError, "error unmarshaling Ticket within AS_REP")
	}
	k.KDCRepFields = KDCRepFields{
		PVNO:    m.PVNO,
		MsgType: m.MsgType,
		PAData:  m.PAData,
		CRealm:  m.CRealm,
		CName:   m.CName,
		Ticket:  tkt,
		EncPart: m.EncPart,
	}
	return nil
}

// Marshal ASRep struct.
func (k *ASRep) Marshal() ([]byte, error) {
	m := marshalKDCRep{
		PVNO:    k.PVNO,
		MsgType: k.MsgType,
		PAData:  k.PAData,
		CRealm:  k.CRealm,
		CName:   k.CName,
		EncPart: k.EncPart,
	}
	b, err := k.Ticket.Marshal()
	if err != nil {
		return []byte{}, err
	}
	m.Ticket = asn1.RawValue{
		Class:      asn1.ClassContextSpecific,
		IsCompound: true,
		Tag:        5,
		Bytes:      b,
	}
	mk, err := asn1.Marshal(m)
	if err != nil {
		return mk, krberror.Errorf(err, krberror.EncodingError, "error marshaling AS_REP")
	}
	mk = asn1tools.AddASNAppTag(mk, asnAppTag.ASREP)
	return mk, nil
}

// Unmarshal bytes b into the TGSRep struct.
func (k *TGSRep) Unmarshal(b []byte) error {
	var m marshalKDCRep
	_, err := asn1.UnmarshalWithParams(b, &m, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.TGSREP))
	if err != nil {
		return processUnmarshalReplyError(b, err)
	}
	if m.MsgType != msgtype.KRB_TGS_REP {
		return krberror.NewErrorf(krberror.KRBMsgError, "message ID does not indicate an TGS_REP. Expected: %v; Actual: %v", msgtype.KRB_TGS_REP, m.MsgType)
	}
	//Process the raw ticket within
	tkt, err := unmarshalTicket(m.Ticket.Bytes)
	if err != nil {
		return krberror.Errorf(err, krberror.EncodingError, "error unmarshaling Ticket within TGS_REP")
	}
	k.KDCRepFields = KDCRepFields{
		PVNO:    m.PVNO,
		MsgType: m.MsgType,
		PAData:  m.PAData,
		CRealm:  m.CRealm,
		CName:   m.CName,
		Ticket:  tkt,
		EncPart: m.EncPart,
	}
	return nil
}

// Marshal TGSRep struct.
func (k *TGSRep) Marshal() ([]byte, error) {
	m := marshalKDCRep{
		PVNO:    k.PVNO,
		MsgType: k.MsgType,
		PAData:  k.PAData,
		CRealm:  k.CRealm,
		CName:   k.CName,
		EncPart: k.EncPart,
	}
	b, err := k.Ticket.Marshal()
	if err != nil {
		return []byte{}, err
	}
	m.Ticket = asn1.RawValue{
		Class:      asn1.ClassContextSpecific,
		IsCompound: true,
		Tag:        5,
		Bytes:      b,
	}
	mk, err := asn1.Marshal(m)
	if err != nil {
		return mk, krberror.Errorf(err, krberror.EncodingError, "error marshaling TGS_REP")
	}
	mk = asn1tools.AddASNAppTag(mk, asnAppTag.TGSREP)
	return mk, nil
}

// Unmarshal bytes b into encrypted part of KRB_KDC_REP.
func (e *EncKDCRepPart) Unmarshal(b []byte) error {
	_, err := asn1.UnmarshalWithParams(b, e, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.EncASRepPart))
	if err != nil {
		// Try using tag 26
		// Ref: RFC 4120 - mentions that some implementations use application tag number 26 wether or not the reply is
		// a AS-REP or a TGS-REP.
		_, err = asn1.UnmarshalWithParams(b, e, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.EncTGSRepPart))
		if err != nil {
			return krberror.Errorf(err, krberror.EncodingError, "error unmarshaling encrypted part within KDC_REP")
		}
	}
	return nil
}

// Marshal encrypted part of KRB_KDC_REP.
func (e *EncKDCRepPart) Marshal() ([]byte, error) {
	b, err := asn1.Marshal(*e)
	if err != nil {
		return b, krberror.Errorf(err, krberror.EncodingError, "marshaling error of AS_REP encpart")
	}
	b = asn1tools.AddASNAppTag(b, asnAppTag.EncASRepPart)
	return b, nil
}

// DecryptEncPart decrypts the encrypted part of an AS_REP.
func (k *ASRep) DecryptEncPart(c *credentials.Credentials) (types.EncryptionKey, error) {
	var key types.EncryptionKey
	var err error
	if c.HasKeytab() {
		key, _, err = c.Keytab().GetEncryptionKey(k.CName, k.CRealm, k.EncPart.KVNO, k.EncPart.EType)
		if err != nil {
			return key, krberror.Errorf(err, krberror.DecryptingError, "error decrypting AS_REP encrypted part")
		}
	}
	if c.HasPassword() {
		key, _, err = crypto.GetKeyFromPassword(c.Password(), k.CName, k.CRealm, k.EncPart.EType, k.PAData)
		if err != nil {
			return key, krberror.Errorf(err, krberror.DecryptingError, "error decrypting AS_REP encrypted part")
		}
	}
	if !c.HasKeytab() && !c.HasPassword() {
		return key, krberror.NewErrorf(krberror.DecryptingError, "no secret available in credentials to perform decryption of AS_REP encrypted part")
	}
	b, err := crypto.DecryptEncPart(k.EncPart, key, keyusage.AS_REP_ENCPART)
	if err != nil {
		return key, krberror.Errorf(err, krberror.DecryptingError, "error decrypting AS_REP encrypted part")
	}
	var denc EncKDCRepPart
	err = denc.Unmarshal(b)
	if err != nil {
		return key, krberror.Errorf(err, krberror.EncodingError, "error unmarshaling decrypted encpart of AS_REP")
	}
	k.DecryptedEncPart = denc
	return key, nil
}

// Verify checks the validity of AS_REP message.
func (k *ASRep) Verify(cfg *config.Config, creds *credentials.Credentials, asReq ASReq) (bool, error) {
	//Ref RFC 4120 Section 3.1.5
	if !k.CName.Equal(asReq.ReqBody.CName) {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "CName in response does not match what was requested. Requested: %+v; Reply: %+v", asReq.ReqBody.CName, k.CName)
	}
	if k.CRealm != asReq.ReqBody.Realm {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "CRealm in response does not match what was requested. Requested: %s; Reply: %s", asReq.ReqBody.Realm, k.CRealm)
	}
	key, err := k.DecryptEncPart(creds)
	if err != nil {
		return false, krberror.Errorf(err, krberror.DecryptingError, "error decrypting EncPart of AS_REP")
	}
	if k.DecryptedEncPart.Nonce != asReq.ReqBody.Nonce {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "possible replay attack, nonce in response does not match that in request")
	}
	if !k.DecryptedEncPart.SName.Equal(asReq.ReqBody.SName) {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "SName in response does not match what was requested. Requested: %v; Reply: %v", asReq.ReqBody.SName, k.DecryptedEncPart.SName)
	}
	if k.DecryptedEncPart.SRealm != asReq.ReqBody.Realm {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "SRealm in response does not match what was requested. Requested: %s; Reply: %s", asReq.ReqBody.Realm, k.DecryptedEncPart.SRealm)
	}
	if len(asReq.ReqBody.Addresses) > 0 {
		if !types.HostAddressesEqual(k.DecryptedEncPart.CAddr, asReq.ReqBody.Addresses) {
			return false, krberror.NewErrorf(krberror.KRBMsgError, "addresses listed in the AS_REP does not match those listed in the AS_REQ")
		}
	}
	t := time.Now().UTC()
	if t.Sub(k.DecryptedEncPart.AuthTime) > cfg.LibDefaults.Clockskew || k.DecryptedEncPart.AuthTime.Sub(t) > cfg.LibDefaults.Clockskew {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "clock skew with KDC too large. Greater than %v seconds", cfg.LibDefaults.Clockskew.Seconds())
	}
	// RFC 6806 https://tools.ietf.org/html/rfc6806.html#section-11
	if asReq.PAData.Contains(patype.PA_REQ_ENC_PA_REP) && types.IsFlagSet(&k.DecryptedEncPart.Flags, flags.EncPARep) {
		if len(k.DecryptedEncPart.EncPAData) < 2 || !k.DecryptedEncPart.EncPAData.Contains(patype.PA_FX_FAST) {
			return false, krberror.NewErrorf(krberror.KRBMsgError, "KDC did not respond appropriately to FAST negotiation")
		}
		for _, pa := range k.DecryptedEncPart.EncPAData {
			if pa.PADataType == patype.PA_REQ_ENC_PA_REP {
				var pafast types.PAReqEncPARep
				err := pafast.Unmarshal(pa.PADataValue)
				if err != nil {
					return false, krberror.Errorf(err, krberror.EncodingError, "KDC FAST negotiation response error, could not unmarshal PA_REQ_ENC_PA_REP")
				}
				etype, err := crypto.GetChksumEtype(pafast.ChksumType)
				if err != nil {
					return false, krberror.Errorf(err, krberror.ChksumError, "KDC FAST negotiation response error")
				}
				ab, _ := asReq.Marshal()
				if !etype.VerifyChecksum(key.KeyValue, ab, pafast.Chksum, keyusage.KEY_USAGE_AS_REQ) {
					return false, krberror.Errorf(err, krberror.ChksumError, "KDC FAST negotiation response checksum invalid")
				}
			}
		}
	}
	return true, nil
}

// DecryptEncPart decrypts the encrypted part of an TGS_REP.
func (k *TGSRep) DecryptEncPart(key types.EncryptionKey) error {
	b, err := crypto.DecryptEncPart(k.EncPart, key, keyusage.TGS_REP_ENCPART_SESSION_KEY)
	if err != nil {
		return krberror.Errorf(err, krberror.DecryptingError, "error decrypting TGS_REP EncPart")
	}
	var denc EncKDCRepPart
	err = denc.Unmarshal(b)
	if err != nil {
		return krberror.Errorf(err, krberror.EncodingError, "error unmarshaling encrypted part")
	}
	k.DecryptedEncPart = denc
	return nil
}

// Verify checks the validity of the TGS_REP message.
func (k *TGSRep) Verify(cfg *config.Config, tgsReq TGSReq) (bool, error) {
	if !k.CName.Equal(tgsReq.ReqBody.CName) {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "CName in response does not match what was requested. Requested: %+v; Reply: %+v", tgsReq.ReqBody.CName, k.CName)
	}
	if k.Ticket.Realm != tgsReq.ReqBody.Realm {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "realm in response ticket does not match what was requested. Requested: %s; Reply: %s", tgsReq.ReqBody.Realm, k.Ticket.Realm)
	}
	if k.DecryptedEncPart.Nonce != tgsReq.ReqBody.Nonce {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "possible replay attack, nonce in response does not match that in request")
	}
	//if k.Ticket.SName.NameType != tgsReq.ReqBody.SName.NameType || k.Ticket.SName.NameString == nil {
	//	return false, krberror.NewErrorf(krberror.KRBMsgError, "SName in response ticket does not match what was requested. Requested: %v; Reply: %v", tgsReq.ReqBody.SName, k.Ticket.SName)
	//}
	//for i := range k.Ticket.SName.NameString {
	//	if k.Ticket.SName.NameString[i] != tgsReq.ReqBody.SName.NameString[i] {
	//		return false, krberror.NewErrorf(krberror.KRBMsgError, "SName in response ticket does not match what was requested. Requested: %+v; Reply: %+v", tgsReq.ReqBody.SName, k.Ticket.SName)
	//	}
	//}
	//if k.DecryptedEncPart.SName.NameType != tgsReq.ReqBody.SName.NameType || k.DecryptedEncPart.SName.NameString == nil {
	//	return false, krberror.NewErrorf(krberror.KRBMsgError, "SName in response does not match what was requested. Requested: %v; Reply: %v", tgsReq.ReqBody.SName, k.DecryptedEncPart.SName)
	//}
	//for i := range k.DecryptedEncPart.SName.NameString {
	//	if k.DecryptedEncPart.SName.NameString[i] != tgsReq.ReqBody.SName.NameString[i] {
	//		return false, krberror.NewErrorf(krberror.KRBMsgError, "SName in response does not match what was requested. Requested: %+v; Reply: %+v", tgsReq.ReqBody.SName, k.DecryptedEncPart.SName)
	//	}
	//}
	if k.DecryptedEncPart.SRealm != tgsReq.ReqBody.Realm {
		return false, krberror.NewErrorf(krberror.KRBMsgError, "SRealm in response does not match what was requested. Requested: %s; Reply: %s", tgsReq.ReqBody.Realm, k.DecryptedEncPart.SRealm)
	}
	if len(k.DecryptedEncPart.CAddr) > 0 {
		if !types.HostAddressesEqual(k.DecryptedEncPart.CAddr, tgsReq.ReqBody.Addresses) {
			return false, krberror.NewErrorf(krberror.KRBMsgError, "addresses listed in the TGS_REP does not match those listed in the TGS_REQ")
		}
	}
	if time.Since(k.DecryptedEncPart.StartTime) > cfg.LibDefaults.Clockskew || k.DecryptedEncPart.StartTime.Sub(time.Now().UTC()) > cfg.LibDefaults.Clockskew {
		if time.Since(k.DecryptedEncPart.AuthTime) > cfg.LibDefaults.Clockskew || k.DecryptedEncPart.AuthTime.Sub(time.Now().UTC()) > cfg.LibDefaults.Clockskew {
			return false, krberror.NewErrorf(krberror.KRBMsgError, "clock skew with KDC too large. Greater than %v seconds.", cfg.LibDefaults.Clockskew.Seconds())
		}
	}
	return true, nil
}
