//go:build go1.9
// +build go1.9

// "go1.9", from Go version 1.9 onward
// See https://golang.org/pkg/go/build/#hdr-Build_Constraints

package roaring

import "math/bits"

// countLeadingOnes returns the number of leading zeros bits in x; the result is 64 for x == 0.
func countLeadingZeros(x uint64) int {
	return bits.LeadingZeros64(x)
}

// countLeadingOnes returns the number of leading ones bits in x; the result is 0 for x == 0.
func countLeadingOnes(x uint64) int {
	return bits.LeadingZeros64(^x)
}
