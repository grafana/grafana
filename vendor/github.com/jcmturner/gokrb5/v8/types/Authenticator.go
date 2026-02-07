// Package types provides Kerberos 5 data types.
package types

import (
	"crypto/rand"
	"fmt"
	"math"
	"math/big"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/asn1tools"
	"github.com/jcmturner/gokrb5/v8/iana"
	"github.com/jcmturner/gokrb5/v8/iana/asnAppTag"
)

// Authenticator - A record containing information that can be shown to have been recently generated using the session
// key known only by the client and server.
// https://tools.ietf.org/html/rfc4120#section-5.5.1
type Authenticator struct {
	AVNO              int               `asn1:"explicit,tag:0"`
	CRealm            string            `asn1:"generalstring,explicit,tag:1"`
	CName             PrincipalName     `asn1:"explicit,tag:2"`
	Cksum             Checksum          `asn1:"explicit,optional,tag:3"`
	Cusec             int               `asn1:"explicit,tag:4"`
	CTime             time.Time         `asn1:"generalized,explicit,tag:5"`
	SubKey            EncryptionKey     `asn1:"explicit,optional,tag:6"`
	SeqNumber         int64             `asn1:"explicit,optional,tag:7"`
	AuthorizationData AuthorizationData `asn1:"explicit,optional,tag:8"`
}

// NewAuthenticator creates a new Authenticator.
func NewAuthenticator(realm string, cname PrincipalName) (Authenticator, error) {
	seq, err := rand.Int(rand.Reader, big.NewInt(math.MaxUint32))
	if err != nil {
		return Authenticator{}, err
	}
	t := time.Now().UTC()
	return Authenticator{
		AVNO:      iana.PVNO,
		CRealm:    realm,
		CName:     cname,
		Cksum:     Checksum{},
		Cusec:     int((t.UnixNano() / int64(time.Microsecond)) - (t.Unix() * 1e6)),
		CTime:     t,
		SeqNumber: seq.Int64() & 0x3fffffff,
	}, nil
}

// GenerateSeqNumberAndSubKey sets the Authenticator's sequence number and subkey.
func (a *Authenticator) GenerateSeqNumberAndSubKey(keyType int32, keySize int) error {
	seq, err := rand.Int(rand.Reader, big.NewInt(math.MaxUint32))
	if err != nil {
		return err
	}
	a.SeqNumber = seq.Int64() & 0x3fffffff
	//Generate subkey value
	sk := make([]byte, keySize, keySize)
	rand.Read(sk)
	a.SubKey = EncryptionKey{
		KeyType:  keyType,
		KeyValue: sk,
	}
	return nil
}

// Unmarshal bytes into the Authenticator.
func (a *Authenticator) Unmarshal(b []byte) error {
	_, err := asn1.UnmarshalWithParams(b, a, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.Authenticator))
	return err
}

// Marshal the Authenticator.
func (a *Authenticator) Marshal() ([]byte, error) {
	b, err := asn1.Marshal(*a)
	if err != nil {
		return nil, err
	}
	b = asn1tools.AddASNAppTag(b, asnAppTag.Authenticator)
	return b, nil
}
