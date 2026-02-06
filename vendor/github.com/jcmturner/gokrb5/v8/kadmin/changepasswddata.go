package kadmin

import (
	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/types"
)

// ChangePasswdData is the payload to a password change message.
type ChangePasswdData struct {
	NewPasswd []byte              `asn1:"explicit,tag:0"`
	TargName  types.PrincipalName `asn1:"explicit,optional,tag:1"`
	TargRealm string              `asn1:"generalstring,optional,explicit,tag:2"`
}

// Marshal ChangePasswdData into a byte slice.
func (c *ChangePasswdData) Marshal() ([]byte, error) {
	b, err := asn1.Marshal(*c)
	if err != nil {
		return []byte{}, err
	}
	//b = asn1tools.AddASNAppTag(b, asnAppTag.)
	return b, nil
}
