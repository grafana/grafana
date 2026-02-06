// Package json is a simple JSON encoder/decoder for gopher-lua.
//
// # Documentation
//
// The following functions are exposed by the library:
//
//	decode(string): Decodes a JSON string. Returns nil and an error string if
//	                the string could not be decoded.
//	encode(value):  Encodes a value into a JSON string. Returns nil and an error
//	                string if the value could not be encoded.
//
// The following types are supported:
//
//	Lua      | JSON
//	---------+-----
//	nil      | null
//	number   | number
//	string   | string
//	table    | object: when table is non-empty and has only string keys
//	         | array:  when table is empty, or has only sequential numeric keys
//	         |         starting from 1
//
// Attempting to encode any other Lua type will result in an error.
//
// # Example
//
// Below is an example usage of the library:
//
//	import (
//	    luajson "layeh.com/gopher-json"
//	)
//
//	L := lua.NewState()
//	luajson.Preload(L)
package json
