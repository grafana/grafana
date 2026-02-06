package geohash

// encoding encapsulates an encoding defined by a given base32 alphabet.
type encoding struct {
	encode string
	decode [256]byte
}

// newEncoding constructs a new encoding defined by the given alphabet,
// which must be a 32-byte string.
func newEncoding(encoder string) *encoding {
	e := new(encoding)
	e.encode = encoder
	for i := 0; i < len(e.decode); i++ {
		e.decode[i] = 0xff
	}
	for i := 0; i < len(encoder); i++ {
		e.decode[encoder[i]] = byte(i)
	}
	return e
}

// Decode string into bits of a 64-bit word. The string s may be at most 12
// characters.
func (e *encoding) Decode(s string) uint64 {
	x := uint64(0)
	for i := 0; i < len(s); i++ {
		x = (x << 5) | uint64(e.decode[s[i]])
	}
	return x
}

// Encode bits of 64-bit word into a string.
func (e *encoding) Encode(x uint64) string {
	b := [12]byte{}
	for i := 0; i < 12; i++ {
		b[11-i] = e.encode[x&0x1f]
		x >>= 5
	}
	return string(b[:])
}

// Base32Encoding with the Geohash alphabet.
var base32encoding = newEncoding("0123456789bcdefghjkmnpqrstuvwxyz")
