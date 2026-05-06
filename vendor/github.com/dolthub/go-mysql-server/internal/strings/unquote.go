package strings

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"unicode/utf8"
)

// Unquote returns a json unquoted string.
// The implementation is taken from TiDB
// https://github.com/pingcap/tidb/blob/a594287e9f402037b06930026906547000006bb6/types/json/binary_functions.go#L89
func Unquote(s string) (string, error) {
	ret := new(bytes.Buffer)
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' {
			i++
			if i == len(s) {
				ret.WriteByte('\\')
				break
			}
			switch s[i] {
			case '"':
				ret.WriteByte('"')
			case 'b':
				ret.WriteByte('\b')
			case 'f':
				ret.WriteByte('\f')
			case 'n':
				ret.WriteByte('\n')
			case 'r':
				ret.WriteByte('\r')
			case 't':
				ret.WriteByte('\t')
			case '\\':
				ret.WriteByte('\\')
			case 'u':
				if i+4 > len(s) {
					return "", fmt.Errorf("Invalid unicode: %s", s[i+1:])
				}
				char, size, err := decodeEscapedUnicode([]byte(s[i+1 : i+5]))
				if err != nil {
					return "", err
				}
				ret.Write(char[0:size])
				i += 4
			default:
				// For all other escape sequences, backslash is ignored.
				ret.WriteByte(s[i])
			}
		} else {
			ret.WriteByte(s[i])
		}
	}

	str := ret.String()
	strlen := len(str)
	// Remove prefix and suffix '"'.
	if strlen > 1 {
		head, tail := str[0], str[strlen-1]
		if head == '"' && tail == '"' {
			return str[1 : strlen-1], nil
		}
	}
	return str, nil
}

// UnquoteBytes is the same as Unquote, except it modifies a byte slice in-place
// Be careful: by reusing the slice, this destroys the original input value.
func UnquoteBytes(b []byte) ([]byte, error) {
	outIdx := 0
	for i := 0; i < len(b); i++ {
		if b[i] == '\\' {
			i++
			if i == len(b) {
				b[outIdx] = '\\'
			}
			switch b[i] {
			case '"':
				b[outIdx] = '"'
			case 'b':
				b[outIdx] = '\b'
			case 'f':
				b[outIdx] = '\f'
			case 'n':
				b[outIdx] = '\n'
			case 'r':
				b[outIdx] = '\r'
			case 't':
				b[outIdx] = '\t'
			case '\\':
				b[outIdx] = '\\'
			case 'u':
				if i+4 > len(b) {
					return nil, fmt.Errorf("Invalid unicode: %s", b[i+1:])
				}
				char, size, err := decodeEscapedUnicode(b[i+1 : i+5])
				if err != nil {
					return nil, err
				}
				for j, c := range char[:size] {
					b[outIdx+j] = c
				}
				i += 4
			default:
				// For all other escape sequences, backslash is ignored.
				b[outIdx] = b[i]
			}
		} else {
			b[outIdx] = b[i]
		}
		outIdx++
	}
	b = b[:outIdx]

	// Remove prefix and suffix '"'.
	if outIdx > 1 {
		head, tail := b[0], b[outIdx-1]
		if head == '"' && tail == '"' {
			return b[1 : outIdx-1], nil
		}
	}
	return b, nil
}

// decodeEscapedUnicode decodes unicode into utf8 bytes specified in RFC 3629.
// According RFC 3629, the max length of utf8 characters is 4 bytes.
// And MySQL use 4 bytes to represent the unicode which must be in [0, 65536).
// The implementation is taken from TiDB:
// https://github.com/pingcap/tidb/blob/a594287e9f402037b06930026906547000006bb6/types/json/binary_functions.go#L136
func decodeEscapedUnicode(s []byte) (char [4]byte, size int, err error) {
	size, err = hex.Decode(char[0:2], s)
	if err != nil || size != 2 {
		// The unicode must can be represented in 2 bytes.
		return char, 0, err
	}
	var unicode uint16
	err = binary.Read(bytes.NewReader(char[0:2]), binary.BigEndian, &unicode)
	if err != nil {
		return char, 0, err
	}
	size = utf8.RuneLen(rune(unicode))
	utf8.EncodeRune(char[0:size], rune(unicode))
	return
}

// Quote returns a json quoted string with escape characters.
// The implementation is taken from TiDB:
// https://github.com/pingcap/tidb/blob/a594287e9f402037b06930026906547000006bb6/types/json/binary_functions.go#L155
func Quote(s string) string {
	var escapeByteMap = map[byte]string{
		'\\': "\\\\",
		'"':  "\\\"",
		'\b': "\\b",
		'\f': "\\f",
		'\n': "\\n",
		'\r': "\\r",
		'\t': "\\t",
	}

	ret := new(bytes.Buffer)
	ret.WriteByte('"')

	start := 0
	for i := 0; i < len(s); {
		if b := s[i]; b < utf8.RuneSelf {
			escaped, ok := escapeByteMap[b]
			if ok {
				if start < i {
					ret.WriteString(s[start:i])
				}
				ret.WriteString(escaped)
				i++
				start = i
			} else {
				i++
			}
		} else {
			c, size := utf8.DecodeRune([]byte(s[i:]))
			if c == utf8.RuneError && size == 1 { // refer to codes of `binary.marshalStringTo`
				if start < i {
					ret.WriteString(s[start:i])
				}
				ret.WriteString(`\ufffd`)
				i += size
				start = i
				continue
			}
			i += size
		}
	}

	if start < len(s) {
		ret.WriteString(s[start:])
	}

	ret.WriteByte('"')
	return ret.String()
}
