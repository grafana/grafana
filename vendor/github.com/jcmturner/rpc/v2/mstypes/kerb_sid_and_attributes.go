package mstypes

// Attributes of a security group membership and can be combined by using the bitwise OR operation.
// They are used by an access check mechanism to specify whether the membership is to be used in an access check decision.
const (
	SEGroupMandatory        = 31
	SEGroupEnabledByDefault = 30
	SEGroupEnabled          = 29
	SEGroupOwner            = 28
	SEGroupResource         = 2
	//All other bits MUST be set to zero and MUST be  ignored on receipt.
)

// KerbSidAndAttributes implements https://msdn.microsoft.com/en-us/library/cc237947.aspx
type KerbSidAndAttributes struct {
	SID        RPCSID `ndr:"pointer"` // A pointer to an RPC_SID structure.
	Attributes uint32
}

// SetFlag sets a flag in a uint32 attribute value.
func SetFlag(a *uint32, i uint) {
	*a = *a | (1 << (31 - i))
}
