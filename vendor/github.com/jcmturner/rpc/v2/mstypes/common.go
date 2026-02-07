// Package mstypes provides implemnations of some Microsoft data types [MS-DTYP] https://msdn.microsoft.com/en-us/library/cc230283.aspx
package mstypes

// LPWSTR implements https://msdn.microsoft.com/en-us/library/cc230355.aspx
type LPWSTR struct {
	Value string `ndr:"pointer,conformant,varying"`
}

// String returns the string representation of LPWSTR data type.
func (s *LPWSTR) String() string {
	return s.Value
}
