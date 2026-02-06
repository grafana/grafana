package types

import (
	"github.com/jcmturner/gofork/encoding/asn1"
)

// Reference: https://www.ietf.org/rfc/rfc4120.txt
// Section: 5.2.6

// AuthorizationData implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.6
type AuthorizationData []AuthorizationDataEntry

// AuthorizationDataEntry implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.6
type AuthorizationDataEntry struct {
	ADType int32  `asn1:"explicit,tag:0"`
	ADData []byte `asn1:"explicit,tag:1"`
}

// ADIfRelevant implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.6.1
type ADIfRelevant AuthorizationData

// ADKDCIssued implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.6.2
type ADKDCIssued struct {
	ADChecksum Checksum          `asn1:"explicit,tag:0"`
	IRealm     string            `asn1:"optional,generalstring,explicit,tag:1"`
	Isname     PrincipalName     `asn1:"optional,explicit,tag:2"`
	Elements   AuthorizationData `asn1:"explicit,tag:3"`
}

// ADAndOr implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.6.3
type ADAndOr struct {
	ConditionCount int32             `asn1:"explicit,tag:0"`
	Elements       AuthorizationData `asn1:"explicit,tag:1"`
}

// ADMandatoryForKDC implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.6.4
type ADMandatoryForKDC AuthorizationData

// Unmarshal bytes into the ADKDCIssued.
func (a *ADKDCIssued) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}

// Unmarshal bytes into the AuthorizationData.
func (a *AuthorizationData) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}

// Unmarshal bytes into the AuthorizationDataEntry.
func (a *AuthorizationDataEntry) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}
