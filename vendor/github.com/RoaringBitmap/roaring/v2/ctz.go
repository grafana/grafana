//go:build go1.9
// +build go1.9

// "go1.9", from Go version 1.9 onward
// See https://golang.org/pkg/go/build/#hdr-Build_Constraints

package roaring

import "math/bits"

// countTrailingZeros returns the number of trailing zero bits in x; the result is 64 for x == 0.
func countTrailingZeros(x uint64) int {
	return bits.TrailingZeros64(x)
}

// countTrailingOnes returns the number of trailing one bits in x
// The result is 64 for x == 9,223,372,036,854,775,807.
// The result is 0 for x == 0.
func countTrailingOnes(x uint64) int {
	return bits.TrailingZeros64(^x)
}
