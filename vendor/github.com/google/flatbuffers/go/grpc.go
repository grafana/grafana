package flatbuffers

import "errors"

var (
	// Codec implements gRPC-go Codec which is used to encode and decode messages.
	Codec = "flatbuffers"

	// ErrInsufficientData is returned when the data is too short to read the root UOffsetT.
	ErrInsufficientData = errors.New("insufficient data")

	// ErrInvalidRootOffset is returned when the root UOffsetT is out of bounds.
	ErrInvalidRootOffset = errors.New("invalid root offset")
)

// FlatbuffersCodec defines the interface gRPC uses to encode and decode messages.  Note
// that implementations of this interface must be thread safe; a Codec's
// methods can be called from concurrent goroutines.
type FlatbuffersCodec struct{}

// Marshal returns the wire format of v.
func (FlatbuffersCodec) Marshal(v interface{}) ([]byte, error) {
	return v.(*Builder).FinishedBytes(), nil
}

// Unmarshal parses the wire format into v.
func (FlatbuffersCodec) Unmarshal(data []byte, v interface{}) error {
	// Need at least 4 bytes to read the root table offset (UOffsetT).
	// Vtable soffset_t and metadata are read later during field access.
	if len(data) < SizeUOffsetT {
		return ErrInsufficientData
	}

	off := GetUOffsetT(data)

	// The root UOffsetT must be within the data buffer
	// Compare in the unsigned domain to avoid signedness pitfalls
	if off > UOffsetT(len(data)-SizeUOffsetT) {
		return ErrInvalidRootOffset
	}

	v.(flatbuffersInit).Init(data, off)
	return nil
}

// String  old gRPC Codec interface func
func (FlatbuffersCodec) String() string {
	return Codec
}

// Name returns the name of the Codec implementation. The returned string
// will be used as part of content type in transmission.  The result must be
// static; the result cannot change between calls.
//
// add Name() for ForceCodec interface
func (FlatbuffersCodec) Name() string {
	return Codec
}

type flatbuffersInit interface {
	Init(data []byte, i UOffsetT)
}
