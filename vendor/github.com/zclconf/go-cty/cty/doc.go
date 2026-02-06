// Package cty (pronounced see-tie) provides some infrastructure for a type
// system that might be useful for applications that need to represent
// configuration values provided by the user whose types are not known
// at compile time, particularly if the calling application also allows
// such values to be used in expressions.
//
// The type system consists of primitive types Number, String and Bool, as
// well as List and Map collection types and Object types that can have
// arbitrarily-typed sets of attributes.
//
// A set of operations is defined on these types, which is accessible via
// the wrapper struct Value, which annotates the raw, internal representation
// of a value with its corresponding type.
//
// This package is oriented towards being a building block for configuration
// languages used to bootstrap an application. It is not optimized for use
// in tight loops where CPU time or memory pressure are a concern.
package cty
