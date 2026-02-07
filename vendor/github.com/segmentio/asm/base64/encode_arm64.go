//go:build !purego
// +build !purego

package base64

func encodeARM64(dst []byte, src []byte, lut *int8) (int, int)
