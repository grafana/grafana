//go:build purego || !(amd64 || arm64)
// +build purego !amd64,!arm64

package keyset

func Lookup(keyset []byte, key []byte) int {
	if len(key) > 16 {
		return len(keyset) / 16
	}
	var padded [16]byte
	copy(padded[:], key)

	for i := 0; i < len(keyset); i += 16 {
		if string(padded[:]) == string(keyset[i:i+16]) {
			return i / 16
		}
	}
	return len(keyset) / 16
}
