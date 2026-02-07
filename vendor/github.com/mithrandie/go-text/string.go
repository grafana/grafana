package text

import (
	"unicode"
)

// Width calculates string width to be displayed.
func Width(s string, eastAsianEncoding bool, countDiacriticalSign bool, countFormatCode bool) int {
	l := 0

	inEscSeq := false // Ignore ANSI Escape Sequence
	for _, r := range s {
		if inEscSeq {
			if unicode.IsLetter(r) {
				inEscSeq = false
			}
		} else if r == 27 {
			inEscSeq = true
		} else {
			l = l + RuneWidth(r, eastAsianEncoding, countDiacriticalSign, countFormatCode)
		}
	}
	return l
}

// RuneWidth calculates character width to be displayed.
func RuneWidth(r rune, eastAsianEncoding bool, countDiacriticalSign bool, countFormatCode bool) int {
	switch {
	case unicode.IsControl(r):
		return 0
	case !countFormatCode && (unicode.In(r, FormatCharTable) || unicode.In(r, ZeroWidthSpaceTable)):
		return 0
	case !countDiacriticalSign && unicode.In(r, DiacriticalSignTable):
		return 0
	case unicode.In(r, FullWidthTable):
		return 2
	case eastAsianEncoding && unicode.In(r, AmbiguousTable):
		return 2
	}
	return 1
}

// RuneByteSize calculates byte size of a character.
func RuneByteSize(r rune, encoding Encoding) int {
	if encoding == SJIS {
		return sjisRuneByteSize(r)
	} else if isUTF16Encoding(encoding) {
		return utf16RuneByteSize(r)
	}
	return len(string(r))
}

func isUTF16Encoding(enc Encoding) bool {
	return enc == UTF16 || enc == UTF16BE || enc == UTF16LE || enc == UTF16BEM || enc == UTF16LEM
}

func sjisRuneByteSize(r rune) int {
	if unicode.In(r, SJISSingleByteTable) || unicode.IsControl(r) {
		return 1
	}
	return 2
}

func utf16RuneByteSize(r rune) int {
	if 65536 <= r {
		return 4
	}
	return 2
}

// ByteSize calculates byte size of a string.
func ByteSize(s string, encoding Encoding) int {
	size := 0
	for _, c := range s {
		size = size + RuneByteSize(c, encoding)
	}
	return size
}

// IsRightToLeftLetters returns true if a string is Right-to-Left horizontal writing characters.
func IsRightToLeftLetters(s string) bool {
	inEscSeq := false // Ignore ANSI Escape Sequence
	for _, r := range s {
		if inEscSeq {
			if unicode.IsLetter(r) {
				inEscSeq = false
			}
		} else if r == 27 {
			inEscSeq = true
		} else {
			if !unicode.IsLetter(r) {
				continue
			}
			return unicode.In(r, RightToLeftTable)
		}
	}
	return false
}
