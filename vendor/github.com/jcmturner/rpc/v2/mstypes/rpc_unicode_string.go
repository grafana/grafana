package mstypes

// RPCUnicodeString implements https://msdn.microsoft.com/en-us/library/cc230365.aspx
type RPCUnicodeString struct {
	Length        uint16 // The length, in bytes, of the string pointed to by the Buffer member, not including the terminating null character if any. The length MUST be a multiple of 2. The length SHOULD equal the entire size of the Buffer, in which case there is no terminating null character. Any method that accesses this structure MUST use the Length specified instead of relying on the presence or absence of a null character.
	MaximumLength uint16 // The maximum size, in bytes, of the string pointed to by Buffer. The size MUST be a multiple of 2. If not, the size MUST be decremented by 1 prior to use. This value MUST not be less than Length.
	Value         string `ndr:"pointer,conformant,varying"`
}

// String returns the RPCUnicodeString string value
func (r *RPCUnicodeString) String() string {
	return r.Value
}
