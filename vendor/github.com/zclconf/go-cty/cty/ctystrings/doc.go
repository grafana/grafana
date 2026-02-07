// Package ctystrings is a collection of string manipulation utilities which
// intend to help application developers implement string-manipulation
// functionality in a way that respects the cty model of strings, even when
// they are working in the realm of Go strings.
//
// cty strings are, internally, NFC-normalized as defined in Unicode Standard
// Annex #15 and encoded as UTF-8.
//
// When working with [cty.Value] of string type cty manages this
// automatically as an implementation detail, but when applications call
// [Value.AsString] they will receive a value that has been subjected to that
// normalization, and so may need to take that normalization into account when
// manipulating the resulting string or comparing it with other Go strings
// that did not originate in a [cty.Value].
//
// Although the core representation of [cty.String] only considers whole
// strings, it's also conventional in other locations such as the standard
// library functions to consider strings as being sequences of grapheme
// clusters as defined by Unicode Standard Annex #29, which adds further
// rules about combining multiple consecutive codepoints together into a
// single user-percieved character. Functions that work with substrings should
// always use grapheme clusters as their smallest unit of splitting strings,
// and never break strings in the middle of a grapheme cluster. The functions
// in this package respect that convention unless otherwise stated in their
// documentation.
package ctystrings
