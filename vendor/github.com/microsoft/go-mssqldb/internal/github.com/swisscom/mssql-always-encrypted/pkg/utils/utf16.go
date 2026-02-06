package utils

import (
	"encoding/binary"
	"unicode/utf16"
)

func ConvertUTF16ToLittleEndianBytes(u []uint16) []byte {
	b := make([]byte, 2*len(u))
	for index, value := range u {
		binary.LittleEndian.PutUint16(b[index*2:], value)
	}
	return b
}

func ProcessUTF16LE(inputString string) []byte {
	return ConvertUTF16ToLittleEndianBytes(utf16.Encode([]rune(inputString)))
}
