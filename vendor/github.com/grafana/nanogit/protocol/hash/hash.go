// A Git-oriented hashing implementation. Supports all hashing algorithms that Git does.
package hash

import (
	"encoding/hex"
	"hash"
)

type Hash [20]byte

var Zero Hash // All zeros, no need to initialize

func FromHex(hs string) (Hash, error) {
	if len(hs) == 0 {
		return Zero, nil
	}

	if len(hs) != 40 {
		return Zero, hex.InvalidByteError(len(hs))
	}

	var h Hash
	_, err := hex.Decode(h[:], []byte(hs))
	if err != nil {
		return Zero, err
	}
	return h, nil
}

// MustFromHex is like FromHex but panics if the hex string is invalid.
// It is intended for use in tests and other situations where the hex string
// is known to be valid.
func MustFromHex(hs string) Hash {
	h, err := FromHex(hs)
	if err != nil {
		panic(err)
	}
	return h
}

func (h Hash) String() string {
	return hex.EncodeToString(h[:])
}

func (h Hash) Is(other Hash) bool {
	return h == other
}

type Hasher struct {
	hash.Hash
}
