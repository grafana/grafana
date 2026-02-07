package jsonschema

import (
	"encoding/base64"
	"encoding/json"
)

// Decoders is a registry of functions, which know how to decode
// string encoded in specific format.
//
// New Decoders can be registered by adding to this map. Key is encoding name,
// value is function that knows how to decode string in that format.
var Decoders = map[string]func(string) ([]byte, error){
	"base64": base64.StdEncoding.DecodeString,
}

// MediaTypes is a registry of functions, which know how to validate
// whether the bytes represent data of that mediaType.
//
// New mediaTypes can be registered by adding to this map. Key is mediaType name,
// value is function that knows how to validate that mediaType.
var MediaTypes = map[string]func([]byte) error{
	"application/json": validateJSON,
}

func validateJSON(b []byte) error {
	var v interface{}
	return json.Unmarshal(b, &v)
}
