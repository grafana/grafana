package smetrics

import (
	"strings"
)

// The Soundex encoding. It is a phonetic algorithm that considers how the words sound in English. Soundex maps a string to a 4-byte code consisting of the first letter of the original string and three numbers. Strings that sound similar should map to the same code.
func Soundex(s string) string {
	b := strings.Builder{}
	b.Grow(4)

	p := s[0]
	if p <= 'z' && p >= 'a' {
		p -= 32 // convert to uppercase
	}
	b.WriteByte(p)

	n := 0
	for i := 1; i < len(s); i++ {
		c := s[i]

		if c <= 'z' && c >= 'a' {
			c -= 32 // convert to uppercase
		} else if c < 'A' || c > 'Z' {
			continue
		}

		if c == p {
			continue
		}

		p = c

		switch c {
		case 'B', 'P', 'F', 'V':
			c = '1'
		case 'C', 'S', 'K', 'G', 'J', 'Q', 'X', 'Z':
			c = '2'
		case 'D', 'T':
			c = '3'
		case 'L':
			c = '4'
		case 'M', 'N':
			c = '5'
		case 'R':
			c = '6'
		default:
			continue
		}

		b.WriteByte(c)
		n++
		if n == 3 {
			break
		}
	}

	for i := n; i < 3; i++ {
		b.WriteByte('0')
	}

	return b.String()
}
