package pac

import (
	"bytes"
	"fmt"

	"github.com/jcmturner/rpc/v2/mstypes"
	"github.com/jcmturner/rpc/v2/ndr"
)

// S4UDelegationInfo implements https://msdn.microsoft.com/en-us/library/cc237944.aspx
type S4UDelegationInfo struct {
	S4U2proxyTarget      mstypes.RPCUnicodeString // The name of the principal to whom the application can forward the ticket.
	TransitedListSize    uint32
	S4UTransitedServices []mstypes.RPCUnicodeString `ndr:"pointer,conformant"` // List of all services that have been delegated through by this client and subsequent services or servers.. Size is value of TransitedListSize
}

// Unmarshal bytes into the S4UDelegationInfo struct
func (k *S4UDelegationInfo) Unmarshal(b []byte) (err error) {
	dec := ndr.NewDecoder(bytes.NewReader(b))
	err = dec.Decode(k)
	if err != nil {
		err = fmt.Errorf("error unmarshaling S4UDelegationInfo: %v", err)
	}
	return
}
