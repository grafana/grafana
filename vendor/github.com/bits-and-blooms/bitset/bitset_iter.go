//go:build go1.23
// +build go1.23

package bitset

import (
	"iter"
	"math/bits"
)

func (b *BitSet) EachSet() iter.Seq[uint] {
	return func(yield func(uint) bool) {
		for wordIndex, word := range b.set {
			idx := 0
			for trail := bits.TrailingZeros64(word); trail != 64; trail = bits.TrailingZeros64(word >> idx) {
				if !yield(uint(wordIndex<<log2WordSize + idx + trail)) {
					return
				}
				idx += trail + 1
			}
		}
	}
}
