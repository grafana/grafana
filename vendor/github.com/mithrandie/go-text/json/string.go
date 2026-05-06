package json

import (
	"bytes"
	"errors"
	"strconv"
	"sync"
	"unicode"

	"github.com/mithrandie/go-text"
)

var escapeBufPool = sync.Pool{
	New: func() interface{} {
		return &bytes.Buffer{}
	},
}

func GetEscapeBuf() *bytes.Buffer {
	b := escapeBufPool.Get().(*bytes.Buffer)
	b.Reset()
	return b
}

func PutEscapeBuf(b *bytes.Buffer) {
	escapeBufPool.Put(b)
}

func EncodeRune(r rune) []byte {
	encode := func(r rune) []byte {
		s := strconv.FormatInt(int64(r), 16)

		buf := make([]byte, 0, 6)
		buf = append(buf, '\\', 'u')
		for i := len(s); i < 4; i++ {
			buf = append(buf, '0')
		}
		buf = append(buf, []byte(s)...)

		return buf
	}

	if 65536 <= r {
		high := (r-65536)/1024 + 55296
		low := (r-65536)%1024 + 56320
		return append(encode(high), encode(low)...)
	}

	return encode(r)
}

func Escape(s string) string {
	runes := []rune(s)
	buf := GetEscapeBuf()

	for _, r := range runes {
		switch r {
		case '\\', '"', '/':
			buf.WriteRune('\\')
			buf.WriteRune(r)
		case '\b':
			buf.WriteRune('\\')
			buf.WriteRune('b')
		case '\f':
			buf.WriteRune('\\')
			buf.WriteRune('f')
		case '\n':
			buf.WriteRune('\\')
			buf.WriteRune('n')
		case '\r':
			buf.WriteRune('\\')
			buf.WriteRune('r')
		case '\t':
			buf.WriteRune('\\')
			buf.WriteRune('t')
		default:
			if r <= 31 {
				buf.Write(EncodeRune(r))
			} else {
				buf.WriteRune(r)
			}
		}
	}
	ret := buf.String()
	PutEscapeBuf(buf)
	return ret
}

func EscapeWithHexDigits(s string) string {
	runes := []rune(s)
	buf := GetEscapeBuf()

	for _, r := range runes {
		switch r {
		case '\\', '"', '/', '\b', '\f', '\n', '\r', '\t':
			buf.Write(EncodeRune(r))
		default:
			if r <= 31 {
				buf.Write(EncodeRune(r))
			} else {
				buf.WriteRune(r)
			}
		}
	}
	ret := buf.String()
	PutEscapeBuf(buf)
	return ret
}

func EscapeAll(s string) string {
	runes := []rune(s)
	buf := GetEscapeBuf()

	for _, r := range runes {
		buf.Write(EncodeRune(r))
	}
	ret := buf.String()
	PutEscapeBuf(buf)
	return ret
}

func Unescape(s string) (string, EscapeType) {
	readHexDigits := func(runes []rune, pos int) (rune, error) {
		var r rune

		if len(runes) <= pos+4 {
			return r, errors.New("hex digits read error")
		}

		for i := 1; i < 5; i++ {
			if !unicode.In(runes[pos+i], unicode.ASCII_Hex_Digit) {
				return r, errors.New("hex digits read error")
			}
		}

		i, _ := strconv.ParseInt(string(runes[pos+1:pos+5]), 16, 32)
		r = int32(i)

		return r, nil
	}

	parseHexToRunes := func(runes []rune, pos int) (rune, int, error) {
		var r rune

		high, err := readHexDigits(runes, pos)
		if err != nil {
			return r, pos, err
		}
		pos = pos + 4

		if text.IsHighSurrogate(high) && pos+2 < len(runes) && runes[pos+1] == '\\' && runes[pos+2] == 'u' {
			if low, err := readHexDigits(runes, pos+2); err == nil && text.IsLowSurrogate(low) {
				r = 65536 + (high-55296)*1024 + (low - 56320)
				pos = pos + 6
			}
		}
		if r == 0 {
			r = high
		}

		return r, pos, nil
	}

	escapeType := Backslash
	runes := []rune(s)
	buf := GetEscapeBuf()

	pos := 0
	slen := len(runes)

	for pos < slen {
		switch {
		case runes[pos] == '\\' && (pos+1 < slen):
			pos++
			switch runes[pos] {
			case '"', '\\', '/':
				buf.WriteRune(runes[pos])
			case 'b':
				buf.WriteRune('\b')
			case 'f':
				buf.WriteRune('\f')
			case 'n':
				buf.WriteRune('\n')
			case 'r':
				buf.WriteRune('\r')
			case 't':
				buf.WriteRune('\t')
			case 'u':
				if r, newPos, err := parseHexToRunes(runes, pos); err == nil {
					switch r {
					case '"', '\\', '/', '\b', '\f', '\n', '\r', 't':
						if escapeType < HexDigits {
							escapeType = HexDigits
						}
					default:
						if 31 < r && escapeType < AllWithHexDigits {
							escapeType = AllWithHexDigits
						}
					}

					buf.WriteRune(r)
					pos = newPos
				} else {
					buf.WriteRune('u')
				}
			default:
				buf.WriteRune(runes[pos])
			}
		default:
			buf.WriteRune(runes[pos])
		}

		pos++
	}

	ret := buf.String()
	PutEscapeBuf(buf)
	return ret, escapeType
}
