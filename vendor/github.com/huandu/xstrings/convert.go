// Copyright 2015 Huan Du. All rights reserved.
// Licensed under the MIT license that can be found in the LICENSE file.

package xstrings

import (
	"math/rand"
	"unicode"
	"unicode/utf8"
)

// ToCamelCase is to convert words separated by space, underscore and hyphen to camel case.
//
// Some samples.
//
//	"some_words"      => "someWords"
//	"http_server"     => "httpServer"
//	"no_https"        => "noHttps"
//	"_complex__case_" => "_complex_Case_"
//	"some words"      => "someWords"
//	"GOLANG_IS_GREAT" => "golangIsGreat"
func ToCamelCase(str string) string {
	return toCamelCase(str, false)
}

// ToPascalCase is to convert words separated by space, underscore and hyphen to pascal case.
//
// Some samples.
//
//	"some_words"      => "SomeWords"
//	"http_server"     => "HttpServer"
//	"no_https"        => "NoHttps"
//	"_complex__case_" => "_Complex_Case_"
//	"some words"      => "SomeWords"
//	"GOLANG_IS_GREAT" => "GolangIsGreat"
func ToPascalCase(str string) string {
	return toCamelCase(str, true)
}

func toCamelCase(str string, isBig bool) string {
	if len(str) == 0 {
		return ""
	}

	buf := &stringBuilder{}
	var isFirstRuneUpper bool
	var r0, r1 rune
	var size int

	// leading connector will appear in output.
	for len(str) > 0 {
		r0, size = utf8.DecodeRuneInString(str)
		str = str[size:]

		if !isConnector(r0) {
			isFirstRuneUpper = unicode.IsUpper(r0)

			if isBig {
				r0 = unicode.ToUpper(r0)
			} else {
				r0 = unicode.ToLower(r0)
			}

			break
		}

		buf.WriteRune(r0)
	}

	if len(str) == 0 {
		// A special case for a string contains only 1 rune.
		if size != 0 {
			buf.WriteRune(r0)
		}

		return buf.String()
	}

	for len(str) > 0 {
		r1 = r0
		r0, size = utf8.DecodeRuneInString(str)
		str = str[size:]

		if isConnector(r0) && isConnector(r1) {
			buf.WriteRune(r1)
			continue
		}

		if isConnector(r1) {
			isFirstRuneUpper = unicode.IsUpper(r0)
			r0 = unicode.ToUpper(r0)
		} else {
			if isFirstRuneUpper {
				if unicode.IsUpper(r0) {
					r0 = unicode.ToLower(r0)
				} else {
					isFirstRuneUpper = false
				}
			}

			buf.WriteRune(r1)
		}
	}

	if isFirstRuneUpper && !isBig {
		r0 = unicode.ToLower(r0)
	}

	buf.WriteRune(r0)
	return buf.String()
}

// ToSnakeCase can convert all upper case characters in a string to
// snake case format.
//
// Some samples.
//
//	"FirstName"    => "first_name"
//	"HTTPServer"   => "http_server"
//	"NoHTTPS"      => "no_https"
//	"GO_PATH"      => "go_path"
//	"GO PATH"      => "go_path"  // space is converted to underscore.
//	"GO-PATH"      => "go_path"  // hyphen is converted to underscore.
//	"http2xx"      => "http_2xx" // insert an underscore before a number and after an alphabet.
//	"HTTP20xOK"    => "http_20x_ok"
//	"Duration2m3s" => "duration_2m3s"
//	"Bld4Floor3rd" => "bld4_floor_3rd"
func ToSnakeCase(str string) string {
	return camelCaseToLowerCase(str, '_')
}

// ToKebabCase can convert all upper case characters in a string to
// kebab case format.
//
// Some samples.
//
//	"FirstName"    => "first-name"
//	"HTTPServer"   => "http-server"
//	"NoHTTPS"      => "no-https"
//	"GO_PATH"      => "go-path"
//	"GO PATH"      => "go-path"  // space is converted to '-'.
//	"GO-PATH"      => "go-path"  // hyphen is converted to '-'.
//	"http2xx"      => "http-2xx" // insert an underscore before a number and after an alphabet.
//	"HTTP20xOK"    => "http-20x-ok"
//	"Duration2m3s" => "duration-2m3s"
//	"Bld4Floor3rd" => "bld4-floor-3rd"
func ToKebabCase(str string) string {
	return camelCaseToLowerCase(str, '-')
}

func camelCaseToLowerCase(str string, connector rune) string {
	if len(str) == 0 {
		return ""
	}

	buf := &stringBuilder{}
	wt, word, remaining := nextWord(str)

	for len(remaining) > 0 {
		if wt != connectorWord {
			toLower(buf, wt, word, connector)
		}

		prev := wt
		last := word
		wt, word, remaining = nextWord(remaining)

		switch prev {
		case numberWord:
			for wt == alphabetWord || wt == numberWord {
				toLower(buf, wt, word, connector)
				wt, word, remaining = nextWord(remaining)
			}

			if wt != invalidWord && wt != punctWord && wt != connectorWord {
				buf.WriteRune(connector)
			}

		case connectorWord:
			toLower(buf, prev, last, connector)

		case punctWord:
			// nothing.

		default:
			if wt != numberWord {
				if wt != connectorWord && wt != punctWord {
					buf.WriteRune(connector)
				}

				break
			}

			if len(remaining) == 0 {
				break
			}

			last := word
			wt, word, remaining = nextWord(remaining)

			// consider number as a part of previous word.
			// e.g. "Bld4Floor" => "bld4_floor"
			if wt != alphabetWord {
				toLower(buf, numberWord, last, connector)

				if wt != connectorWord && wt != punctWord {
					buf.WriteRune(connector)
				}

				break
			}

			// if there are some lower case letters following a number,
			// add connector before the number.
			// e.g. "HTTP2xx" => "http_2xx"
			buf.WriteRune(connector)
			toLower(buf, numberWord, last, connector)

			for wt == alphabetWord || wt == numberWord {
				toLower(buf, wt, word, connector)
				wt, word, remaining = nextWord(remaining)
			}

			if wt != invalidWord && wt != connectorWord && wt != punctWord {
				buf.WriteRune(connector)
			}
		}
	}

	toLower(buf, wt, word, connector)
	return buf.String()
}

func isConnector(r rune) bool {
	return r == '-' || r == '_' || unicode.IsSpace(r)
}

type wordType int

const (
	invalidWord wordType = iota
	numberWord
	upperCaseWord
	alphabetWord
	connectorWord
	punctWord
	otherWord
)

func nextWord(str string) (wt wordType, word, remaining string) {
	if len(str) == 0 {
		return
	}

	var offset int
	remaining = str
	r, size := nextValidRune(remaining, utf8.RuneError)
	offset += size

	if r == utf8.RuneError {
		wt = invalidWord
		word = str[:offset]
		remaining = str[offset:]
		return
	}

	switch {
	case isConnector(r):
		wt = connectorWord
		remaining = remaining[size:]

		for len(remaining) > 0 {
			r, size = nextValidRune(remaining, r)

			if !isConnector(r) {
				break
			}

			offset += size
			remaining = remaining[size:]
		}

	case unicode.IsPunct(r):
		wt = punctWord
		remaining = remaining[size:]

		for len(remaining) > 0 {
			r, size = nextValidRune(remaining, r)

			if !unicode.IsPunct(r) {
				break
			}

			offset += size
			remaining = remaining[size:]
		}

	case unicode.IsUpper(r):
		wt = upperCaseWord
		remaining = remaining[size:]

		if len(remaining) == 0 {
			break
		}

		r, size = nextValidRune(remaining, r)

		switch {
		case unicode.IsUpper(r):
			prevSize := size
			offset += size
			remaining = remaining[size:]

			for len(remaining) > 0 {
				r, size = nextValidRune(remaining, r)

				if !unicode.IsUpper(r) {
					break
				}

				prevSize = size
				offset += size
				remaining = remaining[size:]
			}

			// it's a bit complex when dealing with a case like "HTTPStatus".
			// it's expected to be splitted into "HTTP" and "Status".
			// Therefore "S" should be in remaining instead of word.
			if len(remaining) > 0 && isAlphabet(r) {
				offset -= prevSize
				remaining = str[offset:]
			}

		case isAlphabet(r):
			offset += size
			remaining = remaining[size:]

			for len(remaining) > 0 {
				r, size = nextValidRune(remaining, r)

				if !isAlphabet(r) || unicode.IsUpper(r) {
					break
				}

				offset += size
				remaining = remaining[size:]
			}
		}

	case isAlphabet(r):
		wt = alphabetWord
		remaining = remaining[size:]

		for len(remaining) > 0 {
			r, size = nextValidRune(remaining, r)

			if !isAlphabet(r) || unicode.IsUpper(r) {
				break
			}

			offset += size
			remaining = remaining[size:]
		}

	case unicode.IsNumber(r):
		wt = numberWord
		remaining = remaining[size:]

		for len(remaining) > 0 {
			r, size = nextValidRune(remaining, r)

			if !unicode.IsNumber(r) {
				break
			}

			offset += size
			remaining = remaining[size:]
		}

	default:
		wt = otherWord
		remaining = remaining[size:]

		for len(remaining) > 0 {
			r, size = nextValidRune(remaining, r)

			if size == 0 || isConnector(r) || isAlphabet(r) || unicode.IsNumber(r) || unicode.IsPunct(r) {
				break
			}

			offset += size
			remaining = remaining[size:]
		}
	}

	word = str[:offset]
	return
}

func nextValidRune(str string, prev rune) (r rune, size int) {
	var sz int

	for len(str) > 0 {
		r, sz = utf8.DecodeRuneInString(str)
		size += sz

		if r != utf8.RuneError {
			return
		}

		str = str[sz:]
	}

	r = prev
	return
}

func toLower(buf *stringBuilder, wt wordType, str string, connector rune) {
	buf.Grow(buf.Len() + len(str))

	if wt != upperCaseWord && wt != connectorWord {
		buf.WriteString(str)
		return
	}

	for len(str) > 0 {
		r, size := utf8.DecodeRuneInString(str)
		str = str[size:]

		if isConnector(r) {
			buf.WriteRune(connector)
		} else if unicode.IsUpper(r) {
			buf.WriteRune(unicode.ToLower(r))
		} else {
			buf.WriteRune(r)
		}
	}
}

// SwapCase will swap characters case from upper to lower or lower to upper.
func SwapCase(str string) string {
	var r rune
	var size int

	buf := &stringBuilder{}

	for len(str) > 0 {
		r, size = utf8.DecodeRuneInString(str)

		switch {
		case unicode.IsUpper(r):
			buf.WriteRune(unicode.ToLower(r))

		case unicode.IsLower(r):
			buf.WriteRune(unicode.ToUpper(r))

		default:
			buf.WriteRune(r)
		}

		str = str[size:]
	}

	return buf.String()
}

// FirstRuneToUpper converts first rune to upper case if necessary.
func FirstRuneToUpper(str string) string {
	if str == "" {
		return str
	}

	r, size := utf8.DecodeRuneInString(str)

	if !unicode.IsLower(r) {
		return str
	}

	buf := &stringBuilder{}
	buf.WriteRune(unicode.ToUpper(r))
	buf.WriteString(str[size:])
	return buf.String()
}

// FirstRuneToLower converts first rune to lower case if necessary.
func FirstRuneToLower(str string) string {
	if str == "" {
		return str
	}

	r, size := utf8.DecodeRuneInString(str)

	if !unicode.IsUpper(r) {
		return str
	}

	buf := &stringBuilder{}
	buf.WriteRune(unicode.ToLower(r))
	buf.WriteString(str[size:])
	return buf.String()
}

// Shuffle randomizes runes in a string and returns the result.
// It uses default random source in `math/rand`.
func Shuffle(str string) string {
	if str == "" {
		return str
	}

	runes := []rune(str)
	index := 0

	for i := len(runes) - 1; i > 0; i-- {
		index = rand.Intn(i + 1)

		if i != index {
			runes[i], runes[index] = runes[index], runes[i]
		}
	}

	return string(runes)
}

// ShuffleSource randomizes runes in a string with given random source.
func ShuffleSource(str string, src rand.Source) string {
	if str == "" {
		return str
	}

	runes := []rune(str)
	index := 0
	r := rand.New(src)

	for i := len(runes) - 1; i > 0; i-- {
		index = r.Intn(i + 1)

		if i != index {
			runes[i], runes[index] = runes[index], runes[i]
		}
	}

	return string(runes)
}

// Successor returns the successor to string.
//
// If there is one alphanumeric rune is found in string, increase the rune by 1.
// If increment generates a "carry", the rune to the left of it is incremented.
// This process repeats until there is no carry, adding an additional rune if necessary.
//
// If there is no alphanumeric rune, the rightmost rune will be increased by 1
// regardless whether the result is a valid rune or not.
//
// Only following characters are alphanumeric.
//   - a - z
//   - A - Z
//   - 0 - 9
//
// Samples (borrowed from ruby's String#succ document):
//
//	"abcd"      => "abce"
//	"THX1138"   => "THX1139"
//	"<<koala>>" => "<<koalb>>"
//	"1999zzz"   => "2000aaa"
//	"ZZZ9999"   => "AAAA0000"
//	"***"       => "**+"
func Successor(str string) string {
	if str == "" {
		return str
	}

	var r rune
	var i int
	carry := ' '
	runes := []rune(str)
	l := len(runes)
	lastAlphanumeric := l

	for i = l - 1; i >= 0; i-- {
		r = runes[i]

		if ('a' <= r && r <= 'y') ||
			('A' <= r && r <= 'Y') ||
			('0' <= r && r <= '8') {
			runes[i]++
			carry = ' '
			lastAlphanumeric = i
			break
		}

		switch r {
		case 'z':
			runes[i] = 'a'
			carry = 'a'
			lastAlphanumeric = i

		case 'Z':
			runes[i] = 'A'
			carry = 'A'
			lastAlphanumeric = i

		case '9':
			runes[i] = '0'
			carry = '0'
			lastAlphanumeric = i
		}
	}

	// Needs to add one character for carry.
	if i < 0 && carry != ' ' {
		buf := &stringBuilder{}
		buf.Grow(l + 4) // Reserve enough space for write.

		if lastAlphanumeric != 0 {
			buf.WriteString(str[:lastAlphanumeric])
		}

		buf.WriteRune(carry)

		for _, r = range runes[lastAlphanumeric:] {
			buf.WriteRune(r)
		}

		return buf.String()
	}

	// No alphanumeric character. Simply increase last rune's value.
	if lastAlphanumeric == l {
		runes[l-1]++
	}

	return string(runes)
}
