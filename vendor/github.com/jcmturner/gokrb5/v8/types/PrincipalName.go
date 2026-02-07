package types

import (
	"strings"

	"github.com/jcmturner/gokrb5/v8/iana/nametype"
)

// Reference: https://www.ietf.org/rfc/rfc4120.txt
// Section: 5.2.2

// PrincipalName implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.2
type PrincipalName struct {
	NameType   int32    `asn1:"explicit,tag:0"`
	NameString []string `asn1:"generalstring,explicit,tag:1"`
}

// NewPrincipalName creates a new PrincipalName from the name type int32 and name string provided.
func NewPrincipalName(ntype int32, spn string) PrincipalName {
	return PrincipalName{
		NameType:   ntype,
		NameString: strings.Split(spn, "/"),
	}
}

// GetSalt returns a salt derived from the PrincipalName.
func (pn PrincipalName) GetSalt(realm string) string {
	var sb []byte
	sb = append(sb, realm...)
	for _, n := range pn.NameString {
		sb = append(sb, n...)
	}
	return string(sb)
}

// Equal tests if the PrincipalName is equal to the one provided.
func (pn PrincipalName) Equal(n PrincipalName) bool {
	if len(pn.NameString) != len(n.NameString) {
		return false
	}
	//https://tools.ietf.org/html/rfc4120#section-6.2 - the name type is not significant when checking for equivalence
	for i, s := range pn.NameString {
		if n.NameString[i] != s {
			return false
		}
	}
	return true
}

// PrincipalNameString returns the PrincipalName in string form.
func (pn PrincipalName) PrincipalNameString() string {
	return strings.Join(pn.NameString, "/")
}

// ParseSPNString will parse a string in the format <service>/<name>@<realm>
// a PrincipalName type will be returned with the name type set to KRB_NT_PRINCIPAL(1)
// and the realm will be returned as a string. If the "@<realm>" suffix
// is not included in the SPN then the value of realm string returned will be ""
func ParseSPNString(spn string) (pn PrincipalName, realm string) {
	if strings.Contains(spn, "@") {
		s := strings.Split(spn, "@")
		realm = s[len(s)-1]
		spn = strings.TrimSuffix(spn, "@"+realm)
	}
	pn = NewPrincipalName(nametype.KRB_NT_PRINCIPAL, spn)
	return
}
