//go:build arm || 386 || mips || mipsle
// +build arm 386 mips mipsle

package mssql

import (
	"encoding/binary"
	"fmt"
	"unicode/utf16"
)

func ucs22str(s []byte) (string, error) {
	if len(s)%2 != 0 {
		return "", fmt.Errorf("illegal UCS2 string length: %d", len(s))
	}
	buf := make([]uint16, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		buf[i/2] = binary.LittleEndian.Uint16(s[i:])
	}
	return string(utf16.Decode(buf)), nil
}
