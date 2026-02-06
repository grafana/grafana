//go:build go1.24
// +build go1.24

package theine

// Deprecated: StringKey was used prior to Go 1.24 when Comparable was unavailable.
// With the introduction of Comparable, special handling for string keys is no longer necessary.
func (b *Builder[K, V]) StringKey(fn func(k K) string) *Builder[K, V] {
	b.options.StringKeyFunc = fn
	return b
}
