package graphql

// Utility types used by the generated code.  In general, these are *not*
// intended for end-users.

// NoUnmarshalJSON is intended for the use of genqlient's generated code only.
//
// It is used to prevent a struct type from inheriting its embed's
// UnmarshalJSON method, so if we construct a type:
//
//	type T struct { E; NoUnmarshalJSON }
//
// where E has an UnmarshalJSON method, T will not inherit it, per the
// [Go selector rules].
//
// [Go selector rules]: https://golang.org/ref/spec#Selectors.
type NoUnmarshalJSON struct{}

// UnmarshalJSON should never be called; it exists only to prevent a sibling
// UnmarshalJSON method from being promoted.
func (NoUnmarshalJSON) UnmarshalJSON(b []byte) error {
	panic("NoUnmarshalJSON.UnmarshalJSON should never be called!")
}

// NoMarshalJSON is intended for the use of genqlient's generated code only.
//
// It is used to prevent a struct type from inheriting its embed's
// MarshalJSON method, so if we construct a type:
//
//	type T struct { E; NoMarshalJSON }
//
// where E has an MarshalJSON method, T will not inherit it, per the
// [Go selector rules].
//
// [Go selector rules]: https://golang.org/ref/spec#Selectors.
type NoMarshalJSON struct{}

// MarshalJSON should never be called; it exists only to prevent a sibling
// MarshalJSON method from being promoted.
func (NoMarshalJSON) MarshalJSON() ([]byte, error) {
	panic("NoUnmarshalJSON.MarshalJSON should never be called!")
}
