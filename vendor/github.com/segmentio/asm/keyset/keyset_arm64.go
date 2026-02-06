//go:build !purego
// +build !purego

package keyset

// Lookup searches for a key in a set of keys, returning its index if
// found. If the key cannot be found, the number of keys is returned.
func Lookup(keyset []byte, key []byte) int
