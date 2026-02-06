// Package stdlib is a collection of cty functions that are expected to be
// generally useful, and are thus factored out into this shared library in
// the hope that cty-using applications will have consistent behavior when
// using these functions.
//
// See the parent package "function" for more information on the purpose
// and usage of cty functions.
//
// This package contains both Go functions, which provide convenient access
// to call the functions from Go code, and the Function objects themselves.
// The latter follow the naming scheme of appending "Func" to the end of
// the function name.
package stdlib
