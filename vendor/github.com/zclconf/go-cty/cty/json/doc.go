// Package json provides functions for serializing cty types and values in
// JSON format, and for decoding them again.
//
// Since the cty type system is a superset of the JSON type system,
// round-tripping through JSON is lossy unless type information is provided
// both at encoding time and decoding time. Callers of this package are
// therefore suggested to define their expected structure as a cty.Type
// and pass it in consistently both when encoding and when decoding, though
// default (type-lossy) behavior is provided for situations where the precise
// representation of the data is not significant.
package json
