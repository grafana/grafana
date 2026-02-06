//go:build amd64 && !purego
// +build amd64,!purego

package base64

import (
	"encoding/base64"

	"github.com/segmentio/asm/cpu"
	"github.com/segmentio/asm/cpu/x86"
)

const (
	encLutSize   = 32
	decLutSize   = 48
	minEncodeLen = 28
	minDecodeLen = 45
)

func newEncoding(encoder string) *Encoding {
	e := &Encoding{base: base64.NewEncoding(encoder)}
	if cpu.X86.Has(x86.AVX2) {
		e.enableEncodeAVX2(encoder)
		e.enableDecodeAVX2(encoder)
	}
	return e
}

func (e *Encoding) enableEncodeAVX2(encoder string) {
	// Translate values 0..63 to the Base64 alphabet. There are five sets:
	//
	// From      To         Add    Index  Example
	// [0..25]   [65..90]   +65        0  ABCDEFGHIJKLMNOPQRSTUVWXYZ
	// [26..51]  [97..122]  +71        1  abcdefghijklmnopqrstuvwxyz
	// [52..61]  [48..57]    -4  [2..11]  0123456789
	// [62]      [43]       -19       12  +
	// [63]      [47]       -16       13  /
	tab := [encLutSize]int8{int8(encoder[0]), int8(encoder[letterRange]) - letterRange}
	for i, ch := range encoder[2*letterRange:] {
		tab[2+i] = int8(ch) - 2*letterRange - int8(i)
	}

	e.enc = encodeAVX2
	e.enclut = tab
}

func (e *Encoding) enableDecodeAVX2(encoder string) {
	c62, c63 := int8(encoder[62]), int8(encoder[63])
	url := c63 == '_'
	if url {
		c63 = '/'
	}

	// Translate values from the Base64 alphabet using five sets. Values outside
	// of these ranges are considered invalid:
	//
	// From       To        Add    Index  Example
	// [47]       [63]      +16        1  /
	// [43]       [62]      +19        2  +
	// [48..57]   [52..61]   +4        3  0123456789
	// [65..90]   [0..25]   -65      4,5  ABCDEFGHIJKLMNOPQRSTUVWXYZ
	// [97..122]  [26..51]  -71      6,7  abcdefghijklmnopqrstuvwxyz
	tab := [decLutSize]int8{
		0, 63 - c63, 62 - c62, 4, -65, -65, -71, -71,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x15, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
		0x11, 0x11, 0x13, 0x1B, 0x1B, 0x1B, 0x1B, 0x1B,
	}
	tab[(c62&15)+16] = 0x1A
	tab[(c63&15)+16] = 0x1A

	if url {
		e.dec = decodeAVX2URI
	} else {
		e.dec = decodeAVX2
	}
	e.declut = tab
}
