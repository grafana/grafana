package json

import (
	"bytes"
	"encoding/json"
	"io"
	"math/bits"
	"reflect"
	"runtime"
	"sync"
	"unsafe"
)

// Delim is documented at https://golang.org/pkg/encoding/json/#Delim
type Delim = json.Delim

// InvalidUTF8Error is documented at https://golang.org/pkg/encoding/json/#InvalidUTF8Error
type InvalidUTF8Error = json.InvalidUTF8Error //nolint:staticcheck // compat.

// InvalidUnmarshalError is documented at https://golang.org/pkg/encoding/json/#InvalidUnmarshalError
type InvalidUnmarshalError = json.InvalidUnmarshalError

// Marshaler is documented at https://golang.org/pkg/encoding/json/#Marshaler
type Marshaler = json.Marshaler

// MarshalerError is documented at https://golang.org/pkg/encoding/json/#MarshalerError
type MarshalerError = json.MarshalerError

// Number is documented at https://golang.org/pkg/encoding/json/#Number
type Number = json.Number

// RawMessage is documented at https://golang.org/pkg/encoding/json/#RawMessage
type RawMessage = json.RawMessage

// A SyntaxError is a description of a JSON syntax error.
type SyntaxError = json.SyntaxError

// Token is documented at https://golang.org/pkg/encoding/json/#Token
type Token = json.Token

// UnmarshalFieldError is documented at https://golang.org/pkg/encoding/json/#UnmarshalFieldError
type UnmarshalFieldError = json.UnmarshalFieldError //nolint:staticcheck // compat.

// UnmarshalTypeError is documented at https://golang.org/pkg/encoding/json/#UnmarshalTypeError
type UnmarshalTypeError = json.UnmarshalTypeError

// Unmarshaler is documented at https://golang.org/pkg/encoding/json/#Unmarshaler
type Unmarshaler = json.Unmarshaler

// UnsupportedTypeError is documented at https://golang.org/pkg/encoding/json/#UnsupportedTypeError
type UnsupportedTypeError = json.UnsupportedTypeError

// UnsupportedValueError is documented at https://golang.org/pkg/encoding/json/#UnsupportedValueError
type UnsupportedValueError = json.UnsupportedValueError

// AppendFlags is a type used to represent configuration options that can be
// applied when formatting json output.
type AppendFlags uint32

const (
	// EscapeHTML is a formatting flag used to to escape HTML in json strings.
	EscapeHTML AppendFlags = 1 << iota

	// SortMapKeys is formatting flag used to enable sorting of map keys when
	// encoding JSON (this matches the behavior of the standard encoding/json
	// package).
	SortMapKeys

	// TrustRawMessage is a performance optimization flag to skip value
	// checking of raw messages. It should only be used if the values are
	// known to be valid json (e.g., they were created by json.Unmarshal).
	TrustRawMessage

	// appendNewline is a formatting flag to enable the addition of a newline
	// in Encode (this matches the behavior of the standard encoding/json
	// package).
	appendNewline
)

// ParseFlags is a type used to represent configuration options that can be
// applied when parsing json input.
type ParseFlags uint32

func (flags ParseFlags) has(f ParseFlags) bool {
	return (flags & f) != 0
}

func (f ParseFlags) kind() Kind {
	return Kind((f >> kindOffset) & 0xFF)
}

func (f ParseFlags) withKind(kind Kind) ParseFlags {
	return (f & ^(ParseFlags(0xFF) << kindOffset)) | (ParseFlags(kind) << kindOffset)
}

const (
	// DisallowUnknownFields is a parsing flag used to prevent decoding of
	// objects to Go struct values when a field of the input does not match
	// with any of the struct fields.
	DisallowUnknownFields ParseFlags = 1 << iota

	// UseNumber is a parsing flag used to load numeric values as Number
	// instead of float64.
	UseNumber

	// DontCopyString is a parsing flag used to provide zero-copy support when
	// loading string values from a json payload. It is not always possible to
	// avoid dynamic memory allocations, for example when a string is escaped in
	// the json data a new buffer has to be allocated, but when the `wire` value
	// can be used as content of a Go value the decoder will simply point into
	// the input buffer.
	DontCopyString

	// DontCopyNumber is a parsing flag used to provide zero-copy support when
	// loading Number values (see DontCopyString and DontCopyRawMessage).
	DontCopyNumber

	// DontCopyRawMessage is a parsing flag used to provide zero-copy support
	// when loading RawMessage values from a json payload. When used, the
	// RawMessage values will not be allocated into new memory buffers and
	// will instead point directly to the area of the input buffer where the
	// value was found.
	DontCopyRawMessage

	// DontMatchCaseInsensitiveStructFields is a parsing flag used to prevent
	// matching fields in a case-insensitive way. This can prevent degrading
	// performance on case conversions, and can also act as a stricter decoding
	// mode.
	DontMatchCaseInsensitiveStructFields

	// Decode integers into *big.Int.
	// Takes precedence over UseNumber for integers.
	UseBigInt

	// Decode in-range integers to int64.
	// Takes precedence over UseNumber and UseBigInt for in-range integers.
	UseInt64

	// Decode in-range positive integers to uint64.
	// Takes precedence over UseNumber, UseBigInt, and UseInt64
	// for positive, in-range integers.
	UseUint64

	// ZeroCopy is a parsing flag that combines all the copy optimizations
	// available in the package.
	//
	// The zero-copy optimizations are better used in request-handler style
	// code where none of the values are retained after the handler returns.
	ZeroCopy = DontCopyString | DontCopyNumber | DontCopyRawMessage

	// validAsciiPrint is an internal flag indicating that the input contains
	// only valid ASCII print chars (0x20 <= c <= 0x7E). If the flag is unset,
	// it's unknown whether the input is valid ASCII print.
	validAsciiPrint ParseFlags = 1 << 28

	// noBackslach is an internal flag indicating that the input does not
	// contain a backslash. If the flag is unset, it's unknown whether the
	// input contains a backslash.
	noBackslash ParseFlags = 1 << 29

	// Bit offset where the kind of the json value is stored.
	//
	// See Kind in token.go for the enum.
	kindOffset ParseFlags = 16
)

// Kind represents the different kinds of value that exist in JSON.
type Kind uint

const (
	Undefined Kind = 0

	Null Kind = 1 // Null is not zero, so we keep zero for "undefined".

	Bool  Kind = 2 // Bit two is set to 1, means it's a boolean.
	False Kind = 2 // Bool + 0
	True  Kind = 3 // Bool + 1

	Num   Kind = 4 // Bit three is set to 1, means it's a number.
	Uint  Kind = 5 // Num + 1
	Int   Kind = 6 // Num + 2
	Float Kind = 7 // Num + 3

	String    Kind = 8 // Bit four is set to 1, means it's a string.
	Unescaped Kind = 9 // String + 1

	Array  Kind = 16 // Equivalent to Delim == '['
	Object Kind = 32 // Equivalent to Delim == '{'
)

// Class returns the class of k.
func (k Kind) Class() Kind { return Kind(1 << uint(bits.Len(uint(k))-1)) }

// Append acts like Marshal but appends the json representation to b instead of
// always reallocating a new slice.
func Append(b []byte, x any, flags AppendFlags) ([]byte, error) {
	if x == nil {
		// Special case for nil values because it makes the rest of the code
		// simpler to assume that it won't be seeing nil pointers.
		return append(b, "null"...), nil
	}

	t := reflect.TypeOf(x)
	p := (*iface)(unsafe.Pointer(&x)).ptr

	cache := cacheLoad()
	c, found := cache[typeid(t)]

	if !found {
		c = constructCachedCodec(t, cache)
	}

	b, err := c.encode(encoder{flags: flags}, b, p)
	runtime.KeepAlive(x)
	return b, err
}

// Escape is a convenience helper to construct an escaped JSON string from s.
// The function escales HTML characters, for more control over the escape
// behavior and to write to a pre-allocated buffer, use AppendEscape.
func Escape(s string) []byte {
	// +10 for extra escape characters, maybe not enough and the buffer will
	// be reallocated.
	b := make([]byte, 0, len(s)+10)
	return AppendEscape(b, s, EscapeHTML)
}

// AppendEscape appends s to b with the string escaped as a JSON value.
// This will include the starting and ending quote characters, and the
// appropriate characters will be escaped correctly for JSON encoding.
func AppendEscape(b []byte, s string, flags AppendFlags) []byte {
	e := encoder{flags: flags}
	b, _ = e.encodeString(b, unsafe.Pointer(&s))
	return b
}

// Unescape is a convenience helper to unescape a JSON value.
// For more control over the unescape behavior and
// to write to a pre-allocated buffer, use AppendUnescape.
func Unescape(s []byte) []byte {
	b := make([]byte, 0, len(s))
	return AppendUnescape(b, s, ParseFlags(0))
}

// AppendUnescape appends s to b with the string unescaped as a JSON value.
// This will remove starting and ending quote characters, and the
// appropriate characters will be escaped correctly as if JSON decoded.
// New space will be reallocated if more space is needed.
func AppendUnescape(b []byte, s []byte, flags ParseFlags) []byte {
	d := decoder{flags: flags}
	buf := new(string)
	d.decodeString(s, unsafe.Pointer(buf))
	return append(b, *buf...)
}

// Compact is documented at https://golang.org/pkg/encoding/json/#Compact
func Compact(dst *bytes.Buffer, src []byte) error {
	return json.Compact(dst, src)
}

// HTMLEscape is documented at https://golang.org/pkg/encoding/json/#HTMLEscape
func HTMLEscape(dst *bytes.Buffer, src []byte) {
	json.HTMLEscape(dst, src)
}

// Indent is documented at https://golang.org/pkg/encoding/json/#Indent
func Indent(dst *bytes.Buffer, src []byte, prefix, indent string) error {
	return json.Indent(dst, src, prefix, indent)
}

// Marshal is documented at https://golang.org/pkg/encoding/json/#Marshal
func Marshal(x any) ([]byte, error) {
	var err error
	buf := encoderBufferPool.Get().(*encoderBuffer)

	if buf.data, err = Append(buf.data[:0], x, EscapeHTML|SortMapKeys); err != nil {
		return nil, err
	}

	b := make([]byte, len(buf.data))
	copy(b, buf.data)
	encoderBufferPool.Put(buf)
	return b, nil
}

// MarshalIndent is documented at https://golang.org/pkg/encoding/json/#MarshalIndent
func MarshalIndent(x any, prefix, indent string) ([]byte, error) {
	b, err := Marshal(x)

	if err == nil {
		tmp := &bytes.Buffer{}
		tmp.Grow(2 * len(b))

		Indent(tmp, b, prefix, indent)
		b = tmp.Bytes()
	}

	return b, err
}

// Unmarshal is documented at https://golang.org/pkg/encoding/json/#Unmarshal
func Unmarshal(b []byte, x any) error {
	r, err := Parse(b, x, 0)
	if len(r) != 0 {
		if _, ok := err.(*SyntaxError); !ok {
			// The encoding/json package prioritizes reporting errors caused by
			// unexpected trailing bytes over other issues; here we emulate this
			// behavior by overriding the error.
			err = syntaxError(r, "invalid character '%c' after top-level value", r[0])
		}
	}
	return err
}

// Parse behaves like Unmarshal but the caller can pass a set of flags to
// configure the parsing behavior.
func Parse(b []byte, x any, flags ParseFlags) ([]byte, error) {
	t := reflect.TypeOf(x)
	p := (*iface)(unsafe.Pointer(&x)).ptr

	d := decoder{flags: flags | internalParseFlags(b)}

	b = skipSpaces(b)

	if t == nil || p == nil || t.Kind() != reflect.Ptr {
		_, r, _, err := d.parseValue(b)
		r = skipSpaces(r)
		if err != nil {
			return r, err
		}
		return r, &InvalidUnmarshalError{Type: t}
	}
	t = t.Elem()

	cache := cacheLoad()
	c, found := cache[typeid(t)]

	if !found {
		c = constructCachedCodec(t, cache)
	}

	r, err := c.decode(d, b, p)
	return skipSpaces(r), err
}

// Valid is documented at https://golang.org/pkg/encoding/json/#Valid
func Valid(data []byte) bool {
	data = skipSpaces(data)
	d := decoder{flags: internalParseFlags(data)}
	_, data, _, err := d.parseValue(data)
	if err != nil {
		return false
	}
	return len(skipSpaces(data)) == 0
}

// Decoder is documented at https://golang.org/pkg/encoding/json/#Decoder
type Decoder struct {
	reader      io.Reader
	buffer      []byte
	remain      []byte
	inputOffset int64
	err         error
	flags       ParseFlags
}

// NewDecoder is documented at https://golang.org/pkg/encoding/json/#NewDecoder
func NewDecoder(r io.Reader) *Decoder { return &Decoder{reader: r} }

// Buffered is documented at https://golang.org/pkg/encoding/json/#Decoder.Buffered
func (dec *Decoder) Buffered() io.Reader {
	return bytes.NewReader(dec.remain)
}

// Decode is documented at https://golang.org/pkg/encoding/json/#Decoder.Decode
func (dec *Decoder) Decode(v any) error {
	raw, err := dec.readValue()
	if err != nil {
		return err
	}
	_, err = Parse(raw, v, dec.flags)
	return err
}

const (
	minBufferSize = 32768
	minReadSize   = 4096
)

// readValue reads one JSON value from the buffer and returns its raw bytes. It
// is optimized for the "one JSON value per line" case.
func (dec *Decoder) readValue() (v []byte, err error) {
	var n int
	var r []byte
	d := decoder{flags: dec.flags}

	for {
		if len(dec.remain) != 0 {
			v, r, _, err = d.parseValue(dec.remain)
			if err == nil {
				dec.remain, n = skipSpacesN(r)
				dec.inputOffset += int64(len(v) + n)
				return
			}
			if len(r) != 0 {
				// Parsing of the next JSON value stopped at a position other
				// than the end of the input buffer, which indicaates that a
				// syntax error was encountered.
				return
			}
		}

		if err = dec.err; err != nil {
			if len(dec.remain) != 0 && err == io.EOF {
				err = io.ErrUnexpectedEOF
			}
			return
		}

		if dec.buffer == nil {
			dec.buffer = make([]byte, 0, minBufferSize)
		} else {
			dec.buffer = dec.buffer[:copy(dec.buffer[:cap(dec.buffer)], dec.remain)]
			dec.remain = nil
		}

		if (cap(dec.buffer) - len(dec.buffer)) < minReadSize {
			buf := make([]byte, len(dec.buffer), 2*cap(dec.buffer))
			copy(buf, dec.buffer)
			dec.buffer = buf
		}

		n, err = io.ReadFull(dec.reader, dec.buffer[len(dec.buffer):cap(dec.buffer)])
		if n > 0 {
			dec.buffer = dec.buffer[:len(dec.buffer)+n]
			if err != nil {
				err = nil
			}
		} else if err == io.ErrUnexpectedEOF {
			err = io.EOF
		}
		dec.remain, n = skipSpacesN(dec.buffer)
		d.flags = dec.flags | internalParseFlags(dec.remain)
		dec.inputOffset += int64(n)
		dec.err = err
	}
}

// DisallowUnknownFields is documented at https://golang.org/pkg/encoding/json/#Decoder.DisallowUnknownFields
func (dec *Decoder) DisallowUnknownFields() { dec.flags |= DisallowUnknownFields }

// UseNumber is documented at https://golang.org/pkg/encoding/json/#Decoder.UseNumber
func (dec *Decoder) UseNumber() { dec.flags |= UseNumber }

// DontCopyString is an extension to the standard encoding/json package
// which instructs the decoder to not copy strings loaded from the json
// payloads when possible.
func (dec *Decoder) DontCopyString() { dec.flags |= DontCopyString }

// DontCopyNumber is an extension to the standard encoding/json package
// which instructs the decoder to not copy numbers loaded from the json
// payloads.
func (dec *Decoder) DontCopyNumber() { dec.flags |= DontCopyNumber }

// DontCopyRawMessage is an extension to the standard encoding/json package
// which instructs the decoder to not allocate RawMessage values in separate
// memory buffers (see the documentation of the DontcopyRawMessage flag for
// more detais).
func (dec *Decoder) DontCopyRawMessage() { dec.flags |= DontCopyRawMessage }

// DontMatchCaseInsensitiveStructFields is an extension to the standard
// encoding/json package which instructs the decoder to not match object fields
// against struct fields in a case-insensitive way, the field names have to
// match exactly to be decoded into the struct field values.
func (dec *Decoder) DontMatchCaseInsensitiveStructFields() {
	dec.flags |= DontMatchCaseInsensitiveStructFields
}

// ZeroCopy is an extension to the standard encoding/json package which enables
// all the copy optimizations of the decoder.
func (dec *Decoder) ZeroCopy() { dec.flags |= ZeroCopy }

// InputOffset returns the input stream byte offset of the current decoder position.
// The offset gives the location of the end of the most recently returned token
// and the beginning of the next token.
func (dec *Decoder) InputOffset() int64 {
	return dec.inputOffset
}

// Encoder is documented at https://golang.org/pkg/encoding/json/#Encoder
type Encoder struct {
	writer io.Writer
	prefix string
	indent string
	buffer *bytes.Buffer
	err    error
	flags  AppendFlags
}

// NewEncoder is documented at https://golang.org/pkg/encoding/json/#NewEncoder
func NewEncoder(w io.Writer) *Encoder {
	return &Encoder{writer: w, flags: EscapeHTML | SortMapKeys | appendNewline}
}

// Encode is documented at https://golang.org/pkg/encoding/json/#Encoder.Encode
func (enc *Encoder) Encode(v any) error {
	if enc.err != nil {
		return enc.err
	}

	var err error
	buf := encoderBufferPool.Get().(*encoderBuffer)

	buf.data, err = Append(buf.data[:0], v, enc.flags)
	if err != nil {
		encoderBufferPool.Put(buf)
		return err
	}

	if (enc.flags & appendNewline) != 0 {
		buf.data = append(buf.data, '\n')
	}
	b := buf.data

	if enc.prefix != "" || enc.indent != "" {
		if enc.buffer == nil {
			enc.buffer = new(bytes.Buffer)
			enc.buffer.Grow(2 * len(buf.data))
		} else {
			enc.buffer.Reset()
		}
		Indent(enc.buffer, buf.data, enc.prefix, enc.indent)
		b = enc.buffer.Bytes()
	}

	if _, err := enc.writer.Write(b); err != nil {
		enc.err = err
	}

	encoderBufferPool.Put(buf)
	return err
}

// SetEscapeHTML is documented at https://golang.org/pkg/encoding/json/#Encoder.SetEscapeHTML
func (enc *Encoder) SetEscapeHTML(on bool) {
	if on {
		enc.flags |= EscapeHTML
	} else {
		enc.flags &= ^EscapeHTML
	}
}

// SetIndent is documented at https://golang.org/pkg/encoding/json/#Encoder.SetIndent
func (enc *Encoder) SetIndent(prefix, indent string) {
	enc.prefix = prefix
	enc.indent = indent
}

// SetSortMapKeys is an extension to the standard encoding/json package which
// allows the program to toggle sorting of map keys on and off.
func (enc *Encoder) SetSortMapKeys(on bool) {
	if on {
		enc.flags |= SortMapKeys
	} else {
		enc.flags &= ^SortMapKeys
	}
}

// SetTrustRawMessage skips value checking when encoding a raw json message. It should only
// be used if the values are known to be valid json, e.g. because they were originally created
// by json.Unmarshal.
func (enc *Encoder) SetTrustRawMessage(on bool) {
	if on {
		enc.flags |= TrustRawMessage
	} else {
		enc.flags &= ^TrustRawMessage
	}
}

// SetAppendNewline is an extension to the standard encoding/json package which
// allows the program to toggle the addition of a newline in Encode on or off.
func (enc *Encoder) SetAppendNewline(on bool) {
	if on {
		enc.flags |= appendNewline
	} else {
		enc.flags &= ^appendNewline
	}
}

var encoderBufferPool = sync.Pool{
	New: func() any { return &encoderBuffer{data: make([]byte, 0, 4096)} },
}

type encoderBuffer struct{ data []byte }
