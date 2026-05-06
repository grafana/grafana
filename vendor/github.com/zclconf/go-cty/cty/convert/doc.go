// Package convert contains some routines for converting between cty types.
// The intent of providing this package is to encourage applications using
// cty to have consistent type conversion behavior for maximal interoperability
// when Values pass from one application to another.
//
// The conversions are categorized into two categories. "Safe" conversions are
// ones that are guaranteed to succeed if given a non-null value of the
// appropriate source type. "Unsafe" conversions, on the other hand, are valid
// for only a subset of input values, and thus may fail with an error when
// called for values outside of that valid subset.
//
// The functions whose names end in Unsafe support all of the conversions that
// are supported by the corresponding functions whose names do not have that
// suffix, and then additional unsafe conversions as well.
package convert
