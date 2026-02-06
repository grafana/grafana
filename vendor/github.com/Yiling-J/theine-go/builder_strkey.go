//go:build !go1.24
// +build !go1.24

package theine

// StringKey add a custom key -> string method, the string will be used in shard hashing.
func (b *Builder[K, V]) StringKey(fn func(k K) string) *Builder[K, V] {
	b.options.StringKeyFunc = fn
	return b
}
