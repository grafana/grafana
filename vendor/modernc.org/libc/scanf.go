// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	"io"
	"strconv"
	"strings"
	"unsafe"
)

// The format string consists of a sequence of directives which describe how to
// process the sequence of input characters.  If processing of a directive
// fails, no further input  is  read,  and scanf()  returns.   A "failure" can
// be either of the following: input failure, meaning that input characters
// were unavailable, or matching failure, meaning that the input was
// inappropriate.
func scanf(r io.ByteScanner, format, args uintptr) (nvalues int32) {
	// var src []byte //TODO-
	var ok bool
out:
	for {
		c := *(*byte)(unsafe.Pointer(format))
		// src = append(src, c) //TODO-
		switch c {
		case '%':
			var n int
			var match bool
			format, n, match = scanfConversion(r, format, &args)
			if !match {
				break out
			}

			nvalues += int32(n)
			ok = true
		case 0:
			break out
		case ' ', '\t', '\n', '\r', '\v', '\f':
			format = skipWhiteSpace(format)
			ok = true
		next:
			for {
				c, err := r.ReadByte()
				if err != nil {
					break out
				}

				switch c {
				case ' ', '\t', '\n', '\r', '\v', '\f':
					// nop
				default:
					r.UnreadByte()
					break next
				}
			}
		default:
			c2, err := r.ReadByte()
			if err != nil {
				break out
			}

			if c2 != c {
				r.UnreadByte()
				break out
			}

			format++
			ok = true
		}
	}
	if ok {
		return nvalues
	}

	return -1 // stdio.EOF but not defined for windows
}

func scanfConversion(r io.ByteScanner, format uintptr, args *uintptr) (_ uintptr, nvalues int, match bool) {
	format++ // '%'

	// Each conversion specification in format begins with either the character '%'
	// or the character sequence "%n$" (see below for the distinction) followed by:

	mod := 0
	width := -1
	discard := false
flags:
	for {
		switch c := *(*byte)(unsafe.Pointer(format)); c {
		case '*':
			// An  optional '*' assignment-suppression character: scanf() reads input as
			// directed by the conversion specification, but discards the input.  No
			// corresponding pointer argument is re‐ quired, and this specification is not
			// included in the count of successful assignments returned by scanf().
			format++
			discard = true
		case '\'':
			// For decimal conversions, an optional quote character (').  This specifies
			// that the input number may include thousands' separators as defined by the
			// LC_NUMERIC category of  the  current locale.  (See setlocale(3).)  The quote
			// character may precede or follow the '*' assignment-suppression character.
			format++
			panic(todo(""))
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			// An  optional  decimal  integer  which  specifies  the maximum field width.
			// Reading of characters stops either when this maximum is reached or when a
			// nonmatching character is found, whichever happens first.  Most conversions
			// discard initial white space characters (the exceptions are noted below), and
			// these discarded characters don't  count  toward  the  maximum field width.
			// String input conversions store a terminating null byte ('\0') to mark the
			// end of the input; the maximum field width does not include this terminator.
			width = 0
		num:
			for {
				var digit int
				switch c := *(*byte)(unsafe.Pointer(format)); {
				default:
					break num
				case c >= '0' && c <= '9':
					format++
					digit = int(c) - '0'
				}
				width0 := width
				width = 10*width + digit
				if width < width0 {
					panic(todo(""))
				}
			}
		case 'h', 'j', 'l', 'L', 'q', 't', 'z':
			format, mod = parseLengthModifier(format)
		default:
			break flags
		}
	}

	// A conversion specifier that specifies the type of input conversion to be
	// performed.
	switch c := *(*byte)(unsafe.Pointer(format)); c {
	case '%':
		// Matches a literal '%'.  That is, %% in the format string matches a single
		// input '%' character.  No conversion is done (but initial white space
		// characters are discarded), and assign‐ ment does not occur.
		format++
		skipReaderWhiteSpace(r)
		c, err := r.ReadByte()
		if err != nil {
			return format, -1, false
		}

		if c == '%' {
			return format, 1, true
		}

		r.UnreadByte()
		return format, 0, false
	case 'd':
		// Matches an optionally signed decimal integer; the next pointer must be a
		// pointer to int.
		format++
		skipReaderWhiteSpace(r)
		var digit, n uint64
		allowSign := true
		neg := false
	dec:
		for ; width != 0; width-- {
			c, err := r.ReadByte()
			if err != nil {
				if match {
					break dec
				}

				return 0, 0, false
			}

			if allowSign {
				switch c {
				case '-':
					allowSign = false
					neg = true
					continue
				case '+':
					allowSign = false
					continue
				}
			}

			switch {
			case c >= '0' && c <= '9':
				digit = uint64(c) - '0'
			default:
				r.UnreadByte()
				break dec
			}
			match = true
			n0 := n
			n = n*10 + digit
			if n < n0 {
				panic(todo(""))
			}
		}
		if !match {
			break
		}

		if !discard {
			arg := VaUintptr(args)
			v := int64(n)
			if neg {
				v = -v
			}
			switch mod {
			case modNone:
				*(*int32)(unsafe.Pointer(arg)) = int32(v)
			case modH:
				*(*int16)(unsafe.Pointer(arg)) = int16(v)
			case modHH:
				*(*int8)(unsafe.Pointer(arg)) = int8(v)
			case modL:
				*(*long)(unsafe.Pointer(arg)) = long(v)
			case modLL:
				*(*int64)(unsafe.Pointer(arg)) = int64(v)
			default:
				panic(todo("", mod))
			}
		}
		nvalues = 1
	case 'D':
		// Equivalent  to  ld;  this  exists  only for backward compatibility.  (Note:
		// thus only in libc4.  In libc5 and glibc the %D is silently ignored, causing
		// old programs to fail mysteriously.)
		format++
		panic(todo(""))
	case 'i':
		// Matches an optionally signed integer; the next pointer must be a pointer to
		// int.  The integer is read in base 16 if it begins with 0x or 0X, in base 8
		// if it begins with  0,  and  in base 10 otherwise.  Only characters that
		// correspond to the base are used.
		format++
		panic(todo(""))
	case 'o':
		// Matches an unsigned octal integer; the next pointer must be a pointer to
		// unsigned int.
		format++
		panic(todo(""))
	case 'u':
		// Matches an unsigned decimal integer; the next pointer must be a pointer to
		// unsigned int.
		format++
		panic(todo(""))
	case 'x', 'X':
		// Matches an unsigned hexadecimal integer; the next pointer must be a pointer
		// to unsigned int.
		format++
		skipReaderWhiteSpace(r)
		var digit, n uint64
		allowPrefix := true
		var b []byte
	hex:
		for ; width != 0; width-- {
			c, err := r.ReadByte()
			if err != nil {
				if match || err == io.EOF {
					break hex
				}

				panic(todo("", err))
			}

			if allowPrefix {
				if len(b) == 1 && b[0] == '0' && (c == 'x' || c == 'X') {
					allowPrefix = false
					match = false
					b = nil
					continue
				}

				b = append(b, c)
			}

			switch {
			case c >= '0' && c <= '9':
				digit = uint64(c) - '0'
			case c >= 'a' && c <= 'f':
				digit = uint64(c) - 'a' + 10
			case c >= 'A' && c <= 'F':
				digit = uint64(c) - 'A' + 10
			default:
				r.UnreadByte()
				break hex
			}
			match = true
			n0 := n
			n = n<<4 + digit
			if n < n0 {
				panic(todo(""))
			}
		}
		if !match {
			break
		}

		if !discard {
			arg := VaUintptr(args)
			switch mod {
			case modNone:
				*(*uint32)(unsafe.Pointer(arg)) = uint32(n)
			case modH:
				*(*uint16)(unsafe.Pointer(arg)) = uint16(n)
			case modHH:
				*(*byte)(unsafe.Pointer(arg)) = byte(n)
			case modL:
				*(*ulong)(unsafe.Pointer(arg)) = ulong(n)
			default:
				panic(todo(""))
			}
		}
		nvalues = 1
	case 'f', 'e', 'g', 'E', 'a':
		// Matches an optionally signed floating-point number; the next pointer must be
		// a pointer to float.
		format++
		skipReaderWhiteSpace(r)
		seq := fpLiteral(r)
		if len(seq) == 0 {
			return 0, 0, false
		}

		var neg bool
		switch seq[0] {
		case '+':
			seq = seq[1:]
		case '-':
			neg = true
			seq = seq[1:]
		}
		n, err := strconv.ParseFloat(string(seq), 64)
		if err != nil {
			panic(todo("", err))
		}

		if !discard {
			arg := VaUintptr(args)
			if neg {
				n = -n
			}
			switch mod {
			case modNone:
				*(*float32)(unsafe.Pointer(arg)) = float32(n)
			case modL:
				*(*float64)(unsafe.Pointer(arg)) = n
			default:
				panic(todo("", mod, neg, n))
			}
		}
		return format, 1, true
	case 's':
		// Matches  a  sequence of non-white-space characters; the next pointer must be
		// a pointer to the initial element of a character array that is long enough to
		// hold the input sequence and the terminating null byte ('\0'), which is added
		// automatically.  The input string stops at white space or at the maximum
		// field width, whichever occurs first.
		var c byte
		var err error
		var arg uintptr
		if !discard {
			arg = VaUintptr(args)
		}
	scans:
		for ; width != 0; width-- {
			if c, err = r.ReadByte(); err != nil {
				if err != io.EOF {
					nvalues = -1
				}
				break scans
			}

			switch c {
			case ' ', '\t', '\n', '\r', '\v', '\f':
				break scans
			}

			nvalues = 1
			match = true
			if !discard {
				*(*byte)(unsafe.Pointer(arg)) = c
				arg++
			}
		}
		if match {
			switch {
			case width == 0:
				r.UnreadByte()
				fallthrough
			default:
				if !discard {
					*(*byte)(unsafe.Pointer(arg)) = 0
				}
			}
		}
	case 'c':
		// Matches a sequence of characters whose length is specified by the maximum
		// field width (default 1); the next pointer must be a pointer to char, and
		// there must be enough room for  all the characters (no terminating null byte
		// is added).  The usual skip of leading white space is suppressed.  To skip
		// white space first, use an explicit space in the format.
		format++
		panic(todo(""))
	case '[':
		// Matches  a nonempty sequence of characters from the specified set of
		// accepted characters; the next pointer must be a pointer to char, and there
		// must be enough room for all the char‐ acters in the string, plus a
		// terminating null byte.  The usual skip of leading white space is suppressed.
		// The string is to be made up of characters in (or not in) a particular set;
		// the  set  is defined by the characters between the open bracket [ character
		// and a close bracket ] character.  The set excludes those characters if the
		// first character after the open bracket is a circumflex (^).  To include a
		// close bracket in the set, make it the first character after the open bracket
		// or the circumflex; any other position will end the set.   The hyphen
		// character - is also special; when placed between two other characters, it
		// adds all intervening characters to the set.  To include a hyphen, make it
		// the last character before the final close bracket.  For instance, [^]0-9-]
		// means the set "everything except close bracket, zero through nine, and
		// hyphen".  The string ends with the appearance of a  character not in the
		// (or, with a circumflex, in) set or when the field width runs out.
		format++
		var re0 []byte
	bracket:
		for i := 0; ; i++ {
			c := *(*byte)(unsafe.Pointer(format))
			format++
			if c == ']' && i != 0 {
				break bracket
			}

			re0 = append(re0, c)
		}
		set := map[byte]struct{}{}
		re := string(re0)
		neg := strings.HasPrefix(re, "^")
		if neg {
			re = re[1:]
		}
		for len(re) != 0 {
			switch {
			case len(re) >= 3 && re[1] == '-':
				for c := re[0]; c <= re[2]; c++ {
					set[c] = struct{}{}
				}
				re = re[3:]
			default:
				set[c] = struct{}{}
				re = re[1:]
			}
		}
		var arg uintptr
		if !discard {
			arg = VaUintptr(args)
		}
		for ; width != 0; width-- {
			c, err := r.ReadByte()
			if err != nil {
				if err == io.EOF {
					return format, nvalues, match
				}

				return format, -1, match
			}

			if _, ok := set[c]; ok == !neg {
				match = true
				nvalues = 1
				if !discard {
					*(*byte)(unsafe.Pointer(arg)) = c
					arg++
				}
			}
		}
		if match {
			switch {
			case width == 0:
				r.UnreadByte()
				fallthrough
			default:
				if !discard {
					*(*byte)(unsafe.Pointer(arg)) = 0
				}
			}
		}
	case 'p':
		// Matches a pointer value (as printed by %p in printf(3); the next pointer
		// must be a pointer to a pointer to void.
		format++
		skipReaderWhiteSpace(r)
		c, err := r.ReadByte()
		if err != nil {
			panic(todo("", err))
		}

		if c == '0' {
			if c, err = r.ReadByte(); err != nil {
				panic(todo("", err))
			}

			if c != 'x' && c != 'X' {
				r.UnreadByte()
			}
		}

		var digit, n uint64
	ptr:
		for ; width != 0; width-- {
			c, err := r.ReadByte()
			if err != nil {
				if match {
					break ptr
				}

				panic(todo(""))
			}

			switch {
			case c >= '0' && c <= '9':
				digit = uint64(c) - '0'
			case c >= 'a' && c <= 'f':
				digit = uint64(c) - 'a' + 10
			case c >= 'A' && c <= 'F':
				digit = uint64(c) - 'A' + 10
			default:
				r.UnreadByte()
				break ptr
			}
			match = true
			n0 := n
			n = n<<4 + digit
			if n < n0 {
				panic(todo(""))
			}
		}
		if !match {
			break
		}

		if !discard {
			arg := VaUintptr(args)
			*(*uintptr)(unsafe.Pointer(arg)) = uintptr(n)
		}
		nvalues = 1
	case 'n':
		// Nothing is expected; instead, the number of characters consumed thus far
		// from the input is stored through the next pointer, which must be a pointer
		// to int.  This is not a conversion and does not increase the count returned
		// by the function.  The assignment can be suppressed with the *
		// assignment-suppression character, but the effect on the return value is
		// undefined.  Therefore %*n conversions should not be used.
		format++
		panic(todo(""))
	default:
		panic(todo("%#U", c))
	}

	return format, nvalues, match
}

func skipReaderWhiteSpace(r io.ByteScanner) error {
	for {
		c, err := r.ReadByte()
		if err != nil {
			return err
		}

		switch c {
		case ' ', '\t', '\n', '\r', '\v', '\f':
			// ok
		default:
			r.UnreadByte()
			return nil
		}
	}
}

func skipWhiteSpace(s uintptr) uintptr {
	for {
		switch c := *(*byte)(unsafe.Pointer(s)); c {
		case ' ', '\t', '\n', '\r', '\v', '\f':
			s++
		default:
			return s
		}
	}
}

// [-+]?([0-9]*[.])?[0-9]+([eE][-+]?\d+)?
func fpLiteral(rd io.ByteScanner) (seq []byte) {
	const endOfText = 0x110000
	var pos, width, length int

	defer func() {
		if len(seq) > length {
			rd.UnreadByte()
			seq = seq[:len(seq)-1]
		}
	}()

	var r rune
	step := func(pos int) (rune, int) {
		b, err := rd.ReadByte()
		if err != nil {
			return endOfText, 0
		}

		seq = append(seq, b)
		return rune(b), 1
	}
	move := func() {
		pos += width
		if r != endOfText {
			r, width = step(pos + width)
		}
	}
	accept := func(x rune) bool {
		if r == x {
			move()
			return true
		}
		return false
	}
	accept2 := func(x rune) bool {
		if r <= x {
			move()
			return true
		}
		return false
	}
	r = endOfText
	width = 0
	r, width = step(pos)
	if accept('.') {
		goto l7
	}
	if accept('+') {
		goto l30
	}
	if accept('-') {
		goto l30
	}
	if r < '0' {
		goto l4out
	}
	if accept2('9') {
		goto l35
	}
l4out:
	return seq
l7:
	if r < '0' {
		goto l7out
	}
	if accept2('9') {
		goto l10
	}
l7out:
	return seq
l10:
	length = pos
	if accept('E') {
		goto l18
	}
	if accept('e') {
		goto l18
	}
	if r < '0' {
		goto l15out
	}
	if accept2('9') {
		goto l10
	}
l15out:
	return seq
l18:
	if accept('+') {
		goto l23
	}
	if accept('-') {
		goto l23
	}
	if r < '0' {
		goto l20out
	}
	if accept2('9') {
		goto l26
	}
l20out:
	return seq
l23:
	if r < '0' {
		goto l23out
	}
	if accept2('9') {
		goto l26
	}
l23out:
	return seq
l26:
	length = pos
	if r < '0' {
		goto l27out
	}
	if accept2('9') {
		goto l26
	}
l27out:
	return seq
l30:
	if accept('.') {
		goto l7
	}
	if r < '0' {
		goto l32out
	}
	if accept2('9') {
		goto l35
	}
l32out:
	return seq
l35:
	length = pos
	if accept('.') {
		goto l7
	}
	if accept('E') {
		goto l18
	}
	if accept('e') {
		goto l18
	}
	if r < '0' {
		goto l42out
	}
	if accept2('9') {
		goto l35
	}
l42out:
	return seq
}
