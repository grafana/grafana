package smetrics

import (
	"fmt"
)

// The Hamming distance is the minimum number of substitutions required to change string A into string B. Both strings must have the same size. If the strings have different sizes, the function returns an error.
func Hamming(a, b string) (int, error) {
	al := len(a)
	bl := len(b)

	if al != bl {
		return -1, fmt.Errorf("strings are not equal (len(a)=%d, len(b)=%d)", al, bl)
	}

	var difference = 0

	for i := range a {
		if a[i] != b[i] {
			difference = difference + 1
		}
	}

	return difference, nil
}
