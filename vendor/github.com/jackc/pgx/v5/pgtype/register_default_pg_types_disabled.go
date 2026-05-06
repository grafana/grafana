//go:build nopgxregisterdefaulttypes

package pgtype

func registerDefaultPgTypeVariants[T any](m *Map, name string) {
}
