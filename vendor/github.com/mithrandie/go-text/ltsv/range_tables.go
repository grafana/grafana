package ltsv

import (
	"unicode"
)

var LabelTable = &unicode.RangeTable{
	R16: []unicode.Range16{
		{Lo: 0x002D, Hi: 0x002D, Stride: 1}, // Hyphen-minux
		{Lo: 0x002E, Hi: 0x002E, Stride: 1}, // Full Stop
		{Lo: 0x0030, Hi: 0x0039, Stride: 1}, // ASCII Digits
		{Lo: 0x0041, Hi: 0x005A, Stride: 1}, // Latin Alphabet Upper Case
		{Lo: 0x005F, Hi: 0x005F, Stride: 1}, // Low Line
		{Lo: 0x0061, Hi: 0x007A, Stride: 1}, // Latin Alphabet Lower Case
	},
}

var FieldValueTable = &unicode.RangeTable{
	R16: []unicode.Range16{
		{Lo: 0x0001, Hi: 0x0008, Stride: 1},
		{Lo: 0x000B, Hi: 0x000B, Stride: 1}, // Vertical Tab
		{Lo: 0x000C, Hi: 0x000C, Stride: 1}, // Form Feed
		{Lo: 0x000E, Hi: 0xFFFF, Stride: 1},
	},
	R32: []unicode.Range32{
		{Lo: 0x10000, Hi: 0xfffff, Stride: 1},
	},
}
