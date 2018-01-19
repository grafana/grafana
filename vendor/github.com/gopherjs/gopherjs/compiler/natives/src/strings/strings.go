// +build js

package strings

import (
	"unicode/utf8"

	"github.com/gopherjs/gopherjs/js"
)

func IndexByte(s string, c byte) int {
	return js.InternalObject(s).Call("indexOf", js.Global.Get("String").Call("fromCharCode", c)).Int()
}

func Index(s, sep string) int {
	return js.InternalObject(s).Call("indexOf", js.InternalObject(sep)).Int()
}

func LastIndex(s, sep string) int {
	return js.InternalObject(s).Call("lastIndexOf", js.InternalObject(sep)).Int()
}

func Count(s, sep string) int {
	n := 0
	// special cases
	switch {
	case len(sep) == 0:
		return utf8.RuneCountInString(s) + 1
	case len(sep) > len(s):
		return 0
	case len(sep) == len(s):
		if sep == s {
			return 1
		}
		return 0
	}

	for {
		pos := Index(s, sep)
		if pos == -1 {
			break
		}
		n++
		s = s[pos+len(sep):]
	}
	return n
}
