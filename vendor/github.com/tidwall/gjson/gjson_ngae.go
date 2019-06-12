//+build !appengine
//+build !js

package gjson

import (
	"reflect"
	"unsafe"
)

// getBytes casts the input json bytes to a string and safely returns the
// results as uniquely allocated data. This operation is intended to minimize
// copies and allocations for the large json string->[]byte.
func getBytes(json []byte, path string) Result {
	var result Result
	if json != nil {
		// unsafe cast to string
		result = Get(*(*string)(unsafe.Pointer(&json)), path)
		// safely get the string headers
		rawhi := *(*reflect.StringHeader)(unsafe.Pointer(&result.Raw))
		strhi := *(*reflect.StringHeader)(unsafe.Pointer(&result.Str))
		// create byte slice headers
		rawh := reflect.SliceHeader{Data: rawhi.Data, Len: rawhi.Len}
		strh := reflect.SliceHeader{Data: strhi.Data, Len: strhi.Len}
		if strh.Data == 0 {
			// str is nil
			if rawh.Data == 0 {
				// raw is nil
				result.Raw = ""
			} else {
				// raw has data, safely copy the slice header to a string
				result.Raw = string(*(*[]byte)(unsafe.Pointer(&rawh)))
			}
			result.Str = ""
		} else if rawh.Data == 0 {
			// raw is nil
			result.Raw = ""
			// str has data, safely copy the slice header to a string
			result.Str = string(*(*[]byte)(unsafe.Pointer(&strh)))
		} else if strh.Data >= rawh.Data &&
			int(strh.Data)+strh.Len <= int(rawh.Data)+rawh.Len {
			// Str is a substring of Raw.
			start := int(strh.Data - rawh.Data)
			// safely copy the raw slice header
			result.Raw = string(*(*[]byte)(unsafe.Pointer(&rawh)))
			// substring the raw
			result.Str = result.Raw[start : start+strh.Len]
		} else {
			// safely copy both the raw and str slice headers to strings
			result.Raw = string(*(*[]byte)(unsafe.Pointer(&rawh)))
			result.Str = string(*(*[]byte)(unsafe.Pointer(&strh)))
		}
	}
	return result
}

// fillIndex finds the position of Raw data and assigns it to the Index field
// of the resulting value. If the position cannot be found then Index zero is
// used instead.
func fillIndex(json string, c *parseContext) {
	if len(c.value.Raw) > 0 && !c.calcd {
		jhdr := *(*reflect.StringHeader)(unsafe.Pointer(&json))
		rhdr := *(*reflect.StringHeader)(unsafe.Pointer(&(c.value.Raw)))
		c.value.Index = int(rhdr.Data - jhdr.Data)
		if c.value.Index < 0 || c.value.Index >= len(json) {
			c.value.Index = 0
		}
	}
}

func stringBytes(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(&reflect.SliceHeader{
		Data: (*reflect.StringHeader)(unsafe.Pointer(&s)).Data,
		Len:  len(s),
		Cap:  len(s),
	}))
}

func bytesString(b []byte) string {
	return *(*string)(unsafe.Pointer(&b))
}
