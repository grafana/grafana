package pac

import (
	"bytes"

	"github.com/jcmturner/rpc/v2/mstypes"
)

// ClientInfo implements https://msdn.microsoft.com/en-us/library/cc237951.aspx
type ClientInfo struct {
	ClientID   mstypes.FileTime // A FILETIME structure in little-endian format that contains the Kerberos initial ticket-granting ticket TGT authentication time
	NameLength uint16           // An unsigned 16-bit integer in little-endian format that specifies the length, in bytes, of the Name field.
	Name       string           // An array of 16-bit Unicode characters in little-endian format that contains the client's account name.
}

// Unmarshal bytes into the ClientInfo struct
func (k *ClientInfo) Unmarshal(b []byte) (err error) {
	//The PAC_CLIENT_INFO structure is a simple structure that is not NDR-encoded.
	r := mstypes.NewReader(bytes.NewReader(b))

	k.ClientID, err = r.FileTime()
	if err != nil {
		return
	}
	k.NameLength, err = r.Uint16()
	if err != nil {
		return
	}
	k.Name, err = r.UTF16String(int(k.NameLength))
	return
}
