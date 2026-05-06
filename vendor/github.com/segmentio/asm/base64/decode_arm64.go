//go:build !purego
// +build !purego

package base64

func decodeARM64(dst []byte, src []byte, lut *int8) (int, int)
func decodeStdARM64(dst []byte, src []byte, lut *int8) (int, int)
