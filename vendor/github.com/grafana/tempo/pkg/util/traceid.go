package util

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"unsafe"
)

func HexStringToTraceID(id string) ([]byte, error) {
	return hexStringToID(id, false)
}

// TraceIDToHexString converts a trace ID to its string representation and removes any leading zeros.
func TraceIDToHexString(byteID []byte) string {
	dst := make([]byte, hex.EncodedLen(len(byteID)))
	hex.Encode(dst, byteID)
	// fast conversion to string
	p := unsafe.SliceData(dst)
	id := unsafe.String(p, len(dst))
	// remove leading zeros
	id = strings.TrimLeft(id, "0")
	return id
}

// SpanIDToHexString converts a span ID to its string representation and WITHOUT removing any leading zeros.
// If the id is < 16, left pad with 0s
func SpanIDToHexString(byteID []byte) string {
	dst := make([]byte, hex.EncodedLen(len(byteID)))
	hex.Encode(dst, byteID)
	// fast conversion to string
	p := unsafe.SliceData(dst)
	id := unsafe.String(p, len(dst))
	// remove and pad
	id = strings.TrimLeft(id, "0")
	return fmt.Sprintf("%016s", id)
}

func HexStringToSpanID(id string) ([]byte, error) {
	id = strings.TrimLeft(id, "0")
	return hexStringToID(id, true)
}

// spanKindFNVHashes contains pre-calculated FNV hashes for all span kind values (and two spares)
// defined in the OTEL spec.
var spanKindFNVHashes = [...]uint64{
	0xa8c7f832281a39c5, // unspecified
	0xe3757ca7d64666ea, // internal
	0x1e23011d8472940f, // server
	0x58d08593329ec134, // client
	0x937e0a08e0caee59, // producer
	0xce2b8e7e8ef71b7e, // consumer
	0x8d912f43d2348a3,  // spare 1
	0x43869769eb4f75c8, // spare 2
}

// SpanIDAndKindToToken converts a span ID into a token for use as key in a hash map. The token is generated such
// that it has a low collision probability. In zipkin traces the span id is not guaranteed to be unique as it
// is shared between client and server spans. Therefore, it is sometimes required to take the span kind into account.
func SpanIDAndKindToToken(id []byte, kind int) uint64 {
	if kind < 0 || kind >= len(spanKindFNVHashes) {
		kind = 0
	}
	return SpanIDToUint64(id) ^ spanKindFNVHashes[kind]
}

// SpanIDToUint64 converts a span ID into an uint64 representation. This is useful when using a span ID as key
// in a map. If the ID is longer than 8 bytes, the bytes at larger positions are discarded. The function does
// not make any guarantees about the endianess or ordering of converted IDs.
//
// Note: span IDs are not always unique within a trace (e.g. zipkin traces) SpanIDAndKindToToken could be more
// appropriate in some cases.
func SpanIDToUint64(id []byte) uint64 {
	if len(id) < 8 {
		var idArray [8]byte
		copy(idArray[:], id)
		return *(*uint64)(unsafe.Pointer(&idArray[0]))
	}
	return *(*uint64)(unsafe.Pointer(&id[0]))
}

// EqualHexStringTraceIDs compares two trace ID strings and compares the
// resulting bytes after padding.  Returns true unless there is a reason not
// to.
func EqualHexStringTraceIDs(a, b string) (bool, error) {
	aa, err := HexStringToTraceID(a)
	if err != nil {
		return false, err
	}
	bb, err := HexStringToTraceID(b)
	if err != nil {
		return false, err
	}

	return bytes.Equal(aa, bb), nil
}

func PadTraceIDTo16Bytes(traceID []byte) []byte {
	if len(traceID) > 16 {
		return traceID[len(traceID)-16:]
	}

	if len(traceID) == 16 {
		return traceID
	}

	padded := make([]byte, 16)
	copy(padded[16-len(traceID):], traceID)

	return padded
}

func hexStringToID(id string, isSpan bool) ([]byte, error) {
	// The encoding/hex package does not handle non-hex characters.
	// Ensure the ID has only the proper characters
	for i, c := range id {
		if (c < 'a' || c > 'f') && (c < 'A' || c > 'F') && (c < '0' || c > '9') {
			return nil, fmt.Errorf("trace IDs can only contain hex characters: invalid character '%c' at position %d", c, i+1)
		}
	}

	// the encoding/hex package does not like odd length strings.
	// just append a bit here
	if len(id)%2 == 1 {
		id = "0" + id
	}

	byteID, err := hex.DecodeString(id)
	if err != nil {
		return nil, err
	}

	size := len(byteID)

	if isSpan {
		if size > 8 {
			return nil, errors.New("span IDs can't be larger than 64 bits")
		}
		// if size < 8 {
		// 	byteID = append(make([]byte, 8-size), byteID...)
		// }
		return byteID, nil
	}

	if size > 16 {
		return nil, errors.New("trace IDs can't be larger than 128 bits")
	}
	if size < 16 {
		byteID = append(make([]byte, 16-size), byteID...)
	}

	return byteID, nil
}
