package openapi2

type Header struct {
	Parameter
}

// MarshalJSON returns the JSON encoding of Header.
func (header Header) MarshalJSON() ([]byte, error) {
	return header.Parameter.MarshalJSON()
}

// UnmarshalJSON sets Header to a copy of data.
func (header *Header) UnmarshalJSON(data []byte) error {
	return header.Parameter.UnmarshalJSON(data)
}
