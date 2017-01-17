// Package unidecode implements a unicode transliterator
// which replaces non-ASCII characters with their ASCII
// approximations.
package unidecode

import (
	"sync"
	"unicode"
)

const pooledCapacity = 64

var (
	slicePool    sync.Pool
	decodingOnce sync.Once
)

// Unidecode implements a unicode transliterator, which
// replaces non-ASCII characters with their ASCII
// counterparts.
// Given an unicode encoded string, returns
// another string with non-ASCII characters replaced
// with their closest ASCII counterparts.
// e.g. Unicode("áéíóú") => "aeiou"
func Unidecode(s string) string {
	decodingOnce.Do(decodeTransliterations)
	l := len(s)
	var r []rune
	if l > pooledCapacity {
		r = make([]rune, 0, len(s))
	} else {
		if x := slicePool.Get(); x != nil {
			r = x.([]rune)[:0]
		} else {
			r = make([]rune, 0, pooledCapacity)
		}
	}
	for _, c := range s {
		if c <= unicode.MaxASCII {
			r = append(r, c)
			continue
		}
		if c > unicode.MaxRune || c > transCount {
			/* Ignore reserved chars */
			continue
		}
		if d := transliterations[c]; d != nil {
			r = append(r, d...)
		}
	}
	res := string(r)
	if l <= pooledCapacity {
		slicePool.Put(r)
	}
	return res
}
