package protocol

import (
	"strconv"
	"unicode/utf8"

	"github.com/valyala/bytebufferpool"
)

// Flags describe various encoding options. The behavior may be actually implemented in the encoder, but
// Flags field in writer is used to set and pass them around.
type flags int

const (
	nilMapAsEmpty   flags = 1 << iota // Encode nil map as '{}' rather than 'null'.
	nilSliceAsEmpty                   // Encode nil slice as '[]' rather than 'null'.
)

// writer is a JSON writer.
type writer struct {
	Buffer       *bytebufferpool.ByteBuffer
	Flags        flags
	Error        error
	NoEscapeHTML bool
}

func newWriter() *writer {
	return &writer{
		Buffer: bytebufferpool.Get(),
	}
}

// BuildBytes returns writer data as a single byte slice.
func (w *writer) BuildBytes(reuse ...[]byte) ([]byte, error) {
	if w.Error != nil {
		return nil, w.Error
	}
	var ret []byte
	size := w.Buffer.Len()
	// If we got a buffer as argument and it is big enough, reuse it.
	if len(reuse) == 1 && cap(reuse[0]) >= size {
		ret = reuse[0][:0]
	} else {
		ret = make([]byte, 0, size)
	}
	ret = append(ret, w.Buffer.Bytes()...)
	bytebufferpool.Put(w.Buffer)
	// Make writer non-usable after building bytes - writes will panic.
	w.Buffer = nil
	return ret, nil
}

// BuildBytesNoCopy returns writer data as a single byte slice and returns function to call when data is no longer needed.
func (w *writer) BuildBytesNoCopy() ([]byte, error) {
	if w.Error != nil {
		return nil, w.Error
	}
	buffer := w.Buffer
	// Make writer non-usable after building bytes - writes will panic.
	w.Buffer = nil
	return buffer.Bytes(), nil
}

// RawByte appends raw binary data to the buffer.
func (w *writer) RawByte(c byte) {
	_ = w.Buffer.WriteByte(c)
}

// RawString appends string to the buffer.
func (w *writer) RawString(s string) {
	_, _ = w.Buffer.WriteString(s)
}

// Raw appends raw binary data to the buffer or sets the error if it is given. Useful for
// calling with results of MarshalJSON-like functions.
func (w *writer) Raw(src []byte, err error) {
	switch {
	case w.Error != nil:
		return
	case err != nil:
		w.Error = err
	case len(src) > 0:
		_, _ = w.Buffer.Write(src)
	default:
		w.RawString("null")
	}
}

func (w *writer) Uint32(n uint32) {
	_, _ = w.Buffer.WriteString(strconv.FormatUint(uint64(n), 10))
}

func (w *writer) Uint64(n uint64) {
	_, _ = w.Buffer.WriteString(strconv.FormatUint(n, 10))
}

func (w *writer) Int32(n int32) {
	_, _ = w.Buffer.WriteString(strconv.FormatInt(int64(n), 10))
}

func (w *writer) Int64(n int64) {
	_, _ = w.Buffer.WriteString(strconv.FormatInt(n, 10))
}

func (w *writer) Bool(v bool) {
	if v {
		_, _ = w.Buffer.Write([]byte(`true`))
	} else {
		_, _ = w.Buffer.Write([]byte(`false`))
	}
}

var hexChars = "0123456789abcdef"

func (w *writer) String(s string) {
	escapeHTML := !w.NoEscapeHTML
	_ = w.Buffer.WriteByte('"')
	start := 0
	for i := 0; i < len(s); {
		if b := s[i]; b < utf8.RuneSelf {
			if htmlSafeSet[b] || (!escapeHTML && safeSet[b]) {
				i++
				continue
			}
			if start < i {
				_, _ = w.Buffer.WriteString(s[start:i])
			}
			_ = w.Buffer.WriteByte('\\')
			switch b {
			case '\\', '"':
				_ = w.Buffer.WriteByte(b)
			case '\n':
				_ = w.Buffer.WriteByte('n')
			case '\r':
				_ = w.Buffer.WriteByte('r')
			case '\t':
				_ = w.Buffer.WriteByte('t')
			default:
				// This encodes bytes < 0x20 except for \t, \n and \r.
				// If escapeHTML is set, it also escapes <, >, and &
				// because they can lead to security holes when
				// user-controlled strings are rendered into JSON
				// and served to some browsers.
				_, _ = w.Buffer.WriteString(`u00`)
				_ = w.Buffer.WriteByte(hexChars[b>>4])
				_ = w.Buffer.WriteByte(hexChars[b&0xF])
			}
			i++
			start = i
			continue
		}
		c, size := utf8.DecodeRuneInString(s[i:])
		if c == utf8.RuneError && size == 1 {
			if start < i {
				_, _ = w.Buffer.WriteString(s[start:i])
			}
			_, _ = w.Buffer.WriteString(`\ufffd`)
			i += size
			start = i
			continue
		}
		// U+2028 is LINE SEPARATOR.
		// U+2029 is PARAGRAPH SEPARATOR.
		// They are both technically valid characters in JSON strings,
		// but don't work in JSONP, which has to be evaluated as JavaScript,
		// and can lead to security holes there. It is valid JSON to
		// escape them, so we do so unconditionally.
		// See http://timelessrepo.com/json-isnt-a-javascript-subset for discussion.
		if c == '\u2028' || c == '\u2029' {
			if start < i {
				_, _ = w.Buffer.WriteString(s[start:i])
			}
			_, _ = w.Buffer.WriteString(`\u202`)
			_ = w.Buffer.WriteByte(hexChars[c&0xF])
			i += size
			start = i
			continue
		}
		i += size
	}
	if start < len(s) {
		_, _ = w.Buffer.WriteString(s[start:])
	}
	_ = w.Buffer.WriteByte('"')
}

// safeSet holds the value true if the ASCII character with the given array
// position can be represented inside a JSON string without any further
// escaping.
//
// All values are true except for the ASCII control characters (0-31), the
// double quote ("), and the backslash character ("\").
var safeSet = [utf8.RuneSelf]bool{
	' ':      true,
	'!':      true,
	'"':      false,
	'#':      true,
	'$':      true,
	'%':      true,
	'&':      true,
	'\'':     true,
	'(':      true,
	')':      true,
	'*':      true,
	'+':      true,
	',':      true,
	'-':      true,
	'.':      true,
	'/':      true,
	'0':      true,
	'1':      true,
	'2':      true,
	'3':      true,
	'4':      true,
	'5':      true,
	'6':      true,
	'7':      true,
	'8':      true,
	'9':      true,
	':':      true,
	';':      true,
	'<':      true,
	'=':      true,
	'>':      true,
	'?':      true,
	'@':      true,
	'A':      true,
	'B':      true,
	'C':      true,
	'D':      true,
	'E':      true,
	'F':      true,
	'G':      true,
	'H':      true,
	'I':      true,
	'J':      true,
	'K':      true,
	'L':      true,
	'M':      true,
	'N':      true,
	'O':      true,
	'P':      true,
	'Q':      true,
	'R':      true,
	'S':      true,
	'T':      true,
	'U':      true,
	'V':      true,
	'W':      true,
	'X':      true,
	'Y':      true,
	'Z':      true,
	'[':      true,
	'\\':     false,
	']':      true,
	'^':      true,
	'_':      true,
	'`':      true,
	'a':      true,
	'b':      true,
	'c':      true,
	'd':      true,
	'e':      true,
	'f':      true,
	'g':      true,
	'h':      true,
	'i':      true,
	'j':      true,
	'k':      true,
	'l':      true,
	'm':      true,
	'n':      true,
	'o':      true,
	'p':      true,
	'q':      true,
	'r':      true,
	's':      true,
	't':      true,
	'u':      true,
	'v':      true,
	'w':      true,
	'x':      true,
	'y':      true,
	'z':      true,
	'{':      true,
	'|':      true,
	'}':      true,
	'~':      true,
	'\u007f': true,
}

// htmlSafeSet holds the value true if the ASCII character with the given
// array position can be safely represented inside a JSON string, embedded
// inside of HTML <script> tags, without any additional escaping.
//
// All values are true except for the ASCII control characters (0-31), the
// double quote ("), the backslash character ("\"), HTML opening and closing
// tags ("<" and ">"), and the ampersand ("&").
var htmlSafeSet = [utf8.RuneSelf]bool{
	' ':      true,
	'!':      true,
	'"':      false,
	'#':      true,
	'$':      true,
	'%':      true,
	'&':      false,
	'\'':     true,
	'(':      true,
	')':      true,
	'*':      true,
	'+':      true,
	',':      true,
	'-':      true,
	'.':      true,
	'/':      true,
	'0':      true,
	'1':      true,
	'2':      true,
	'3':      true,
	'4':      true,
	'5':      true,
	'6':      true,
	'7':      true,
	'8':      true,
	'9':      true,
	':':      true,
	';':      true,
	'<':      false,
	'=':      true,
	'>':      false,
	'?':      true,
	'@':      true,
	'A':      true,
	'B':      true,
	'C':      true,
	'D':      true,
	'E':      true,
	'F':      true,
	'G':      true,
	'H':      true,
	'I':      true,
	'J':      true,
	'K':      true,
	'L':      true,
	'M':      true,
	'N':      true,
	'O':      true,
	'P':      true,
	'Q':      true,
	'R':      true,
	'S':      true,
	'T':      true,
	'U':      true,
	'V':      true,
	'W':      true,
	'X':      true,
	'Y':      true,
	'Z':      true,
	'[':      true,
	'\\':     false,
	']':      true,
	'^':      true,
	'_':      true,
	'`':      true,
	'a':      true,
	'b':      true,
	'c':      true,
	'd':      true,
	'e':      true,
	'f':      true,
	'g':      true,
	'h':      true,
	'i':      true,
	'j':      true,
	'k':      true,
	'l':      true,
	'm':      true,
	'n':      true,
	'o':      true,
	'p':      true,
	'q':      true,
	'r':      true,
	's':      true,
	't':      true,
	'u':      true,
	'v':      true,
	'w':      true,
	'x':      true,
	'y':      true,
	'z':      true,
	'{':      true,
	'|':      true,
	'}':      true,
	'~':      true,
	'\u007f': true,
}
