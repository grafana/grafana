package protocol

import (
	"bytes"
	"reflect"
	"strconv"
	"strings"
	"unicode/utf8"
	"unsafe"
)

const (
	escapes            = "\t\n\f\r ,="
	nameEscapes        = "\t\n\f\r ,"
	stringFieldEscapes = "\t\n\f\r\\\""
)

var (
	stringEscaper = strings.NewReplacer(
		"\t", `\t`,
		"\n", `\n`,
		"\f", `\f`,
		"\r", `\r`,
		`,`, `\,`,
		` `, `\ `,
		`=`, `\=`,
	)

	nameEscaper = strings.NewReplacer(
		"\t", `\t`,
		"\n", `\n`,
		"\f", `\f`,
		"\r", `\r`,
		`,`, `\,`,
		` `, `\ `,
	)

	stringFieldEscaper = strings.NewReplacer(
		"\t", `\t`,
		"\n", `\n`,
		"\f", `\f`,
		"\r", `\r`,
		`"`, `\"`,
		`\`, `\\`,
	)
)

var (
	unescaper = strings.NewReplacer(
		`\,`, `,`,
		`\"`, `"`, // ???
		`\ `, ` `,
		`\=`, `=`,
	)

	nameUnescaper = strings.NewReplacer(
		`\,`, `,`,
		`\ `, ` `,
	)

	stringFieldUnescaper = strings.NewReplacer(
		`\"`, `"`,
		`\\`, `\`,
	)
)

// The various escape functions allocate, I'd like to fix that.
// TODO: make escape not allocate

// Escape a tagkey, tagvalue, or fieldkey
func escape(s string) string {
	if strings.ContainsAny(s, escapes) {
		return stringEscaper.Replace(s)
	}
	return s
}

// Escape a measurement name
func nameEscape(s string) string {
	if strings.ContainsAny(s, nameEscapes) {
		return nameEscaper.Replace(s)
	}
	return s
}

// Escape a string field
func stringFieldEscape(s string) string {
	if strings.ContainsAny(s, stringFieldEscapes) {
		return stringFieldEscaper.Replace(s)
	}
	return s
}

const (
	utf8mask  = byte(0x3F)
	utf8bytex = byte(0x80) // 1000 0000
	utf8len2  = byte(0xC0) // 1100 0000
	utf8len3  = byte(0xE0) // 1110 0000
	utf8len4  = byte(0xF0) // 1111 0000
)

func escapeBytes(dest *[]byte, b []byte) {
	if bytes.ContainsAny(b, escapes) {
		var r rune
		for i, j := 0, 0; i < len(b); i += j {
			r, j = utf8.DecodeRune(b[i:])
			switch {
			case r == '\t':
				*dest = append(*dest, `\t`...)
			case r == '\n':
				*dest = append(*dest, `\n`...)
			case r == '\f':
				*dest = append(*dest, `\f`...)
			case r == '\r':
				*dest = append(*dest, `\r`...)
			case r == ',':
				*dest = append(*dest, `\,`...)
			case r == ' ':
				*dest = append(*dest, `\ `...)
			case r == '=':
				*dest = append(*dest, `\=`...)
			case r <= 1<<7-1:
				*dest = append(*dest, byte(r))
			case r <= 1<<11-1:
				*dest = append(*dest, utf8len2|byte(r>>6), utf8bytex|byte(r)&utf8mask)
			case r <= 1<<16-1:
				*dest = append(*dest, utf8len3|byte(r>>12), utf8bytex|byte(r>>6)&utf8mask, utf8bytex|byte(r)&utf8mask)
			default:
				*dest = append(*dest, utf8len4|byte(r>>18), utf8bytex|byte(r>>12)&utf8mask, utf8bytex|byte(r>>6)&utf8mask, utf8bytex|byte(r)&utf8mask)
			}
		}
		return
	}
	*dest = append(*dest, b...)
}

// Escape a measurement name
func nameEscapeBytes(dest *[]byte, b []byte) {
	if bytes.ContainsAny(b, nameEscapes) {
		var r rune
		for i, j := 0, 0; i < len(b); i += j {
			r, j = utf8.DecodeRune(b[i:])
			switch {
			case r == '\t':
				*dest = append(*dest, `\t`...)
			case r == '\n':
				*dest = append(*dest, `\n`...)
			case r == '\f':
				*dest = append(*dest, `\f`...)
			case r == '\r':
				*dest = append(*dest, `\r`...)
			case r == ',':
				*dest = append(*dest, `\,`...)
			case r == ' ':
				*dest = append(*dest, `\ `...)
			case r == '\\':
				*dest = append(*dest, `\\`...)
			case r <= 1<<7-1:
				*dest = append(*dest, byte(r))
			case r <= 1<<11-1:
				*dest = append(*dest, utf8len2|byte(r>>6), utf8bytex|byte(r)&utf8mask)
			case r <= 1<<16-1:
				*dest = append(*dest, utf8len3|byte(r>>12), utf8bytex|byte(r>>6)&utf8mask, utf8bytex|byte(r)&utf8mask)
			default:
				*dest = append(*dest, utf8len4|byte(r>>18), utf8bytex|byte(r>>12)&utf8mask, utf8bytex|byte(r>>6)&utf8mask, utf8bytex|byte(r)&utf8mask)
			}
		}
		return
	}
	*dest = append(*dest, b...)
}

func stringFieldEscapeBytes(dest *[]byte, b []byte) {
	if bytes.ContainsAny(b, stringFieldEscapes) {
		var r rune
		for i, j := 0, 0; i < len(b); i += j {
			r, j = utf8.DecodeRune(b[i:])
			switch {
			case r == '\t':
				*dest = append(*dest, `\t`...)
			case r == '\n':
				*dest = append(*dest, `\n`...)
			case r == '\f':
				*dest = append(*dest, `\f`...)
			case r == '\r':
				*dest = append(*dest, `\r`...)
			case r == ',':
				*dest = append(*dest, `\,`...)
			case r == ' ':
				*dest = append(*dest, `\ `...)
			case r == '\\':
				*dest = append(*dest, `\\`...)
			case r <= 1<<7-1:
				*dest = append(*dest, byte(r))
			case r <= 1<<11-1:
				*dest = append(*dest, utf8len2|byte(r>>6), utf8bytex|byte(r)&utf8mask)
			case r <= 1<<16-1:
				*dest = append(*dest, utf8len3|byte(r>>12), utf8bytex|byte(r>>6)&utf8mask, utf8bytex|byte(r)&utf8mask)
			default:
				*dest = append(*dest, utf8len4|byte(r>>18), utf8bytex|byte(r>>12)&utf8mask, utf8bytex|byte(r>>6)&utf8mask, utf8bytex|byte(r)&utf8mask)
			}
		}
		return
	}
	*dest = append(*dest, b...)
}

func unescape(b []byte) string {
	if bytes.ContainsAny(b, escapes) {
		return unescaper.Replace(unsafeBytesToString(b))
	}
	return string(b)
}

func nameUnescape(b []byte) string {
	if bytes.ContainsAny(b, nameEscapes) {
		return nameUnescaper.Replace(unsafeBytesToString(b))
	}
	return string(b)
}

// unsafeBytesToString converts a []byte to a string without a heap allocation.
//
// It is unsafe, and is intended to prepare input to short-lived functions
// that require strings.
func unsafeBytesToString(in []byte) string {
	src := *(*reflect.SliceHeader)(unsafe.Pointer(&in))
	dst := reflect.StringHeader{
		Data: src.Data,
		Len:  src.Len,
	}
	s := *(*string)(unsafe.Pointer(&dst))
	return s
}

// parseIntBytes is a zero-alloc wrapper around strconv.ParseInt.
func parseIntBytes(b []byte, base int, bitSize int) (i int64, err error) {
	s := unsafeBytesToString(b)
	return strconv.ParseInt(s, base, bitSize)
}

// parseUintBytes is a zero-alloc wrapper around strconv.ParseUint.
func parseUintBytes(b []byte, base int, bitSize int) (i uint64, err error) {
	s := unsafeBytesToString(b)
	return strconv.ParseUint(s, base, bitSize)
}

// parseFloatBytes is a zero-alloc wrapper around strconv.ParseFloat.
func parseFloatBytes(b []byte, bitSize int) (float64, error) {
	s := unsafeBytesToString(b)
	return strconv.ParseFloat(s, bitSize)
}

// parseBoolBytes is a zero-alloc wrapper around strconv.ParseBool.
func parseBoolBytes(b []byte) (bool, error) {
	return strconv.ParseBool(unsafeBytesToString(b))
}

func stringFieldUnescape(b []byte) string {
	if bytes.ContainsAny(b, stringFieldEscapes) {
		return stringFieldUnescaper.Replace(unsafeBytesToString(b))
	}
	return string(b)
}
