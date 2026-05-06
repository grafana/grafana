package pac

import (
	"bytes"

	"github.com/jcmturner/rpc/v2/mstypes"
)

// UPNDNSInfo implements https://msdn.microsoft.com/en-us/library/dd240468.aspx
type UPNDNSInfo struct {
	UPNLength           uint16 // An unsigned 16-bit integer in little-endian format that specifies the length, in bytes, of the UPN field.
	UPNOffset           uint16 // An unsigned 16-bit integer in little-endian format that contains the offset to the beginning of the buffer, in bytes, from the beginning of the UPN_DNS_INFO structure.
	DNSDomainNameLength uint16
	DNSDomainNameOffset uint16
	Flags               uint32
	UPN                 string
	DNSDomain           string
}

const (
	upnNoUPNAttr = 31 // The user account object does not have the userPrincipalName attribute ([MS-ADA3] section 2.349) set. A UPN constructed by concatenating the user name with the DNS domain name of the account domain is provided.
)

// Unmarshal bytes into the UPN_DNSInfo struct
func (k *UPNDNSInfo) Unmarshal(b []byte) (err error) {
	//The UPN_DNS_INFO structure is a simple structure that is not NDR-encoded.
	r := mstypes.NewReader(bytes.NewReader(b))
	k.UPNLength, err = r.Uint16()
	if err != nil {
		return
	}
	k.UPNOffset, err = r.Uint16()
	if err != nil {
		return
	}
	k.DNSDomainNameLength, err = r.Uint16()
	if err != nil {
		return
	}
	k.DNSDomainNameOffset, err = r.Uint16()
	if err != nil {
		return
	}
	k.Flags, err = r.Uint32()
	if err != nil {
		return
	}
	ub := mstypes.NewReader(bytes.NewReader(b[k.UPNOffset : k.UPNOffset+k.UPNLength]))
	db := mstypes.NewReader(bytes.NewReader(b[k.DNSDomainNameOffset : k.DNSDomainNameOffset+k.DNSDomainNameLength]))

	u := make([]rune, k.UPNLength/2, k.UPNLength/2)
	for i := 0; i < len(u); i++ {
		var r uint16
		r, err = ub.Uint16()
		if err != nil {
			return
		}
		u[i] = rune(r)
	}
	k.UPN = string(u)
	d := make([]rune, k.DNSDomainNameLength/2, k.DNSDomainNameLength/2)
	for i := 0; i < len(d); i++ {
		var r uint16
		r, err = db.Uint16()
		if err != nil {
			return
		}
		d[i] = rune(r)
	}
	k.DNSDomain = string(d)

	return
}
