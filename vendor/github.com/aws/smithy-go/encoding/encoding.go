package encoding

import (
	"fmt"
	"math"
	"strconv"
)

// EncodeFloat encodes a float value as per the stdlib encoder for json and xml protocol
// This encodes a float value into dst while attempting to conform to ES6 ToString for Numbers
//
// Based on encoding/json floatEncoder from the Go Standard Library
// https://golang.org/src/encoding/json/encode.go
func EncodeFloat(dst []byte, v float64, bits int) []byte {
	if math.IsInf(v, 0) || math.IsNaN(v) {
		panic(fmt.Sprintf("invalid float value: %s", strconv.FormatFloat(v, 'g', -1, bits)))
	}

	abs := math.Abs(v)
	fmt := byte('f')

	if abs != 0 {
		if bits == 64 && (abs < 1e-6 || abs >= 1e21) || bits == 32 && (float32(abs) < 1e-6 || float32(abs) >= 1e21) {
			fmt = 'e'
		}
	}

	dst = strconv.AppendFloat(dst, v, fmt, -1, bits)

	if fmt == 'e' {
		// clean up e-09 to e-9
		n := len(dst)
		if n >= 4 && dst[n-4] == 'e' && dst[n-3] == '-' && dst[n-2] == '0' {
			dst[n-2] = dst[n-1]
			dst = dst[:n-1]
		}
	}

	return dst
}
