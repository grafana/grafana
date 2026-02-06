package messages

import (
	"fmt"
	"log"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/asn1tools"
	"github.com/jcmturner/gokrb5/v8/crypto"
	"github.com/jcmturner/gokrb5/v8/iana"
	"github.com/jcmturner/gokrb5/v8/iana/adtype"
	"github.com/jcmturner/gokrb5/v8/iana/asnAppTag"
	"github.com/jcmturner/gokrb5/v8/iana/errorcode"
	"github.com/jcmturner/gokrb5/v8/iana/flags"
	"github.com/jcmturner/gokrb5/v8/iana/keyusage"
	"github.com/jcmturner/gokrb5/v8/keytab"
	"github.com/jcmturner/gokrb5/v8/krberror"
	"github.com/jcmturner/gokrb5/v8/pac"
	"github.com/jcmturner/gokrb5/v8/types"
)

// Reference: https://www.ietf.org/rfc/rfc4120.txt
// Section: 5.3

// Ticket implements the Kerberos ticket.
type Ticket struct {
	TktVNO           int                 `asn1:"explicit,tag:0"`
	Realm            string              `asn1:"generalstring,explicit,tag:1"`
	SName            types.PrincipalName `asn1:"explicit,tag:2"`
	EncPart          types.EncryptedData `asn1:"explicit,tag:3"`
	DecryptedEncPart EncTicketPart       `asn1:"optional"` // Not part of ASN1 bytes so marked as optional so unmarshalling works
}

// EncTicketPart is the encrypted part of the Ticket.
type EncTicketPart struct {
	Flags             asn1.BitString          `asn1:"explicit,tag:0"`
	Key               types.EncryptionKey     `asn1:"explicit,tag:1"`
	CRealm            string                  `asn1:"generalstring,explicit,tag:2"`
	CName             types.PrincipalName     `asn1:"explicit,tag:3"`
	Transited         TransitedEncoding       `asn1:"explicit,tag:4"`
	AuthTime          time.Time               `asn1:"generalized,explicit,tag:5"`
	StartTime         time.Time               `asn1:"generalized,explicit,optional,tag:6"`
	EndTime           time.Time               `asn1:"generalized,explicit,tag:7"`
	RenewTill         time.Time               `asn1:"generalized,explicit,optional,tag:8"`
	CAddr             types.HostAddresses     `asn1:"explicit,optional,tag:9"`
	AuthorizationData types.AuthorizationData `asn1:"explicit,optional,tag:10"`
}

// TransitedEncoding part of the ticket's encrypted part.
type TransitedEncoding struct {
	TRType   int32  `asn1:"explicit,tag:0"`
	Contents []byte `asn1:"explicit,tag:1"`
}

// NewTicket creates a new Ticket instance.
func NewTicket(cname types.PrincipalName, crealm string, sname types.PrincipalName, srealm string, flags asn1.BitString, sktab *keytab.Keytab, eTypeID int32, kvno int, authTime, startTime, endTime, renewTill time.Time) (Ticket, types.EncryptionKey, error) {
	etype, err := crypto.GetEtype(eTypeID)
	if err != nil {
		return Ticket{}, types.EncryptionKey{}, krberror.Errorf(err, krberror.EncryptingError, "error getting etype for new ticket")
	}
	sessionKey, err := types.GenerateEncryptionKey(etype)
	if err != nil {
		return Ticket{}, types.EncryptionKey{}, krberror.Errorf(err, krberror.EncryptingError, "error generating session key")
	}

	etp := EncTicketPart{
		Flags:     flags,
		Key:       sessionKey,
		CRealm:    crealm,
		CName:     cname,
		Transited: TransitedEncoding{},
		AuthTime:  authTime,
		StartTime: startTime,
		EndTime:   endTime,
		RenewTill: renewTill,
	}
	b, err := asn1.Marshal(etp)
	if err != nil {
		return Ticket{}, types.EncryptionKey{}, krberror.Errorf(err, krberror.EncodingError, "error marshalling ticket encpart")
	}
	b = asn1tools.AddASNAppTag(b, asnAppTag.EncTicketPart)
	skey, _, err := sktab.GetEncryptionKey(sname, srealm, kvno, eTypeID)
	if err != nil {
		return Ticket{}, types.EncryptionKey{}, krberror.Errorf(err, krberror.EncryptingError, "error getting encryption key for new ticket")
	}
	ed, err := crypto.GetEncryptedData(b, skey, keyusage.KDC_REP_TICKET, kvno)
	if err != nil {
		return Ticket{}, types.EncryptionKey{}, krberror.Errorf(err, krberror.EncryptingError, "error encrypting ticket encpart")
	}
	tkt := Ticket{
		TktVNO:  iana.PVNO,
		Realm:   srealm,
		SName:   sname,
		EncPart: ed,
	}
	return tkt, sessionKey, nil
}

// Unmarshal bytes b into a Ticket struct.
func (t *Ticket) Unmarshal(b []byte) error {
	_, err := asn1.UnmarshalWithParams(b, t, fmt.Sprintf("application,explicit,tag:%d", asnAppTag.Ticket))
	return err
}

// Marshal the Ticket.
func (t *Ticket) Marshal() ([]byte, error) {
	b, err := asn1.Marshal(*t)
	if err != nil {
		return nil, err
	}
	b = asn1tools.AddASNAppTag(b, asnAppTag.Ticket)
	return b, nil
}

// Unmarshal bytes b into the EncTicketPart struct.
func (t *EncTicketPart) Unmarshal(b []byte) error {
	_, err := asn1.UnmarshalWithParams(b, t, fmt.Sprintf("application,explicit,tag:%d", asnAppTag.EncTicketPart))
	return err
}

// unmarshalTicket returns a ticket from the bytes provided.
func unmarshalTicket(b []byte) (t Ticket, err error) {
	err = t.Unmarshal(b)
	return
}

// UnmarshalTicketsSequence returns a slice of Tickets from a raw ASN1 value.
func unmarshalTicketsSequence(in asn1.RawValue) ([]Ticket, error) {
	//This is a workaround to a asn1 decoding issue in golang - https://github.com/golang/go/issues/17321. It's not pretty I'm afraid
	//We pull out raw values from the larger raw value (that is actually the data of the sequence of raw values) and track our position moving along the data.
	b := in.Bytes
	// Ignore the head of the asn1 stream (1 byte for tag and those for the length) as this is what tells us its a sequence but we're handling it ourselves
	p := 1 + asn1tools.GetNumberBytesInLengthHeader(in.Bytes)
	var tkts []Ticket
	var raw asn1.RawValue
	for p < (len(b)) {
		_, err := asn1.UnmarshalWithParams(b[p:], &raw, fmt.Sprintf("application,tag:%d", asnAppTag.Ticket))
		if err != nil {
			return nil, fmt.Errorf("unmarshaling sequence of tickets failed getting length of ticket: %v", err)
		}
		t, err := unmarshalTicket(b[p:])
		if err != nil {
			return nil, fmt.Errorf("unmarshaling sequence of tickets failed: %v", err)
		}
		p += len(raw.FullBytes)
		tkts = append(tkts, t)
	}
	MarshalTicketSequence(tkts)
	return tkts, nil
}

// MarshalTicketSequence marshals a slice of Tickets returning an ASN1 raw value containing the ticket sequence.
func MarshalTicketSequence(tkts []Ticket) (asn1.RawValue, error) {
	raw := asn1.RawValue{
		Class:      2,
		IsCompound: true,
	}
	if len(tkts) < 1 {
		// There are no tickets to marshal
		return raw, nil
	}
	var btkts []byte
	for i, t := range tkts {
		b, err := t.Marshal()
		if err != nil {
			return raw, fmt.Errorf("error marshaling ticket number %d in sequence of tickets", i+1)
		}
		btkts = append(btkts, b...)
	}
	// The ASN1 wrapping consists of 2 bytes:
	// 1st byte -> Identifier Octet - In this case an OCTET STRING (ASN TAG
	// 2nd byte -> The length (this will be the size indicated in the input bytes + 2 for the additional bytes we add here.
	// Application Tag:
	//| Byte:       | 8                            | 7                          | 6                                         | 5 | 4 | 3 | 2 | 1             |
	//| Value:      | 0                            | 1                          | 1                                         | From the RFC spec 4120        |
	//| Explanation | Defined by the ASN1 encoding rules for an application tag | A value of 1 indicates a constructed type | The ASN Application tag value |
	btkts = append(asn1tools.MarshalLengthBytes(len(btkts)), btkts...)
	btkts = append([]byte{byte(32 + asn1.TagSequence)}, btkts...)
	raw.Bytes = btkts
	// If we need to create the full bytes then identifier octet is "context-specific" = 128 + "constructed" + 32 + the wrapping explicit tag (11)
	//fmt.Fprintf(os.Stderr, "mRaw fb: %v\n", raw.FullBytes)
	return raw, nil
}

// DecryptEncPart decrypts the encrypted part of the ticket.
// The sname argument can be used to specify which service principal's key should be used to decrypt the ticket.
// If nil is passed as the sname then the service principal specified within the ticket it used.
func (t *Ticket) DecryptEncPart(keytab *keytab.Keytab, sname *types.PrincipalName) error {
	if sname == nil {
		sname = &t.SName
	}
	key, _, err := keytab.GetEncryptionKey(*sname, t.Realm, t.EncPart.KVNO, t.EncPart.EType)
	if err != nil {
		return NewKRBError(t.SName, t.Realm, errorcode.KRB_AP_ERR_NOKEY, fmt.Sprintf("Could not get key from keytab: %v", err))
	}
	return t.Decrypt(key)
}

// Decrypt decrypts the encrypted part of the ticket using the key provided.
func (t *Ticket) Decrypt(key types.EncryptionKey) error {
	b, err := crypto.DecryptEncPart(t.EncPart, key, keyusage.KDC_REP_TICKET)
	if err != nil {
		return fmt.Errorf("error decrypting Ticket EncPart: %v", err)
	}
	var denc EncTicketPart
	err = denc.Unmarshal(b)
	if err != nil {
		return fmt.Errorf("error unmarshaling encrypted part: %v", err)
	}
	t.DecryptedEncPart = denc
	return nil
}

// GetPACType returns a Microsoft PAC that has been extracted from the ticket and processed.
func (t *Ticket) GetPACType(keytab *keytab.Keytab, sname *types.PrincipalName, l *log.Logger) (bool, pac.PACType, error) {
	var isPAC bool
	for _, ad := range t.DecryptedEncPart.AuthorizationData {
		if ad.ADType == adtype.ADIfRelevant {
			var ad2 types.AuthorizationData
			err := ad2.Unmarshal(ad.ADData)
			if err != nil {
				l.Printf("PAC authorization data could not be unmarshaled: %v", err)
				continue
			}
			if ad2[0].ADType == adtype.ADWin2KPAC {
				isPAC = true
				var p pac.PACType
				err = p.Unmarshal(ad2[0].ADData)
				if err != nil {
					return isPAC, p, fmt.Errorf("error unmarshaling PAC: %v", err)
				}
				if sname == nil {
					sname = &t.SName
				}
				key, _, err := keytab.GetEncryptionKey(*sname, t.Realm, t.EncPart.KVNO, t.EncPart.EType)
				if err != nil {
					return isPAC, p, NewKRBError(t.SName, t.Realm, errorcode.KRB_AP_ERR_NOKEY, fmt.Sprintf("Could not get key from keytab: %v", err))
				}
				err = p.ProcessPACInfoBuffers(key, l)
				return isPAC, p, err
			}
		}
	}
	return isPAC, pac.PACType{}, nil
}

// Valid checks it the ticket is currently valid. Max duration passed endtime passed in as argument.
func (t *Ticket) Valid(d time.Duration) (bool, error) {
	// Check for future tickets or invalid tickets
	time := time.Now().UTC()
	if t.DecryptedEncPart.StartTime.Sub(time) > d || types.IsFlagSet(&t.DecryptedEncPart.Flags, flags.Invalid) {
		return false, NewKRBError(t.SName, t.Realm, errorcode.KRB_AP_ERR_TKT_NYV, "service ticket provided is not yet valid")
	}

	// Check for expired ticket
	if time.Sub(t.DecryptedEncPart.EndTime) > d {
		return false, NewKRBError(t.SName, t.Realm, errorcode.KRB_AP_ERR_TKT_EXPIRED, "service ticket provided has expired")
	}

	return true, nil
}
