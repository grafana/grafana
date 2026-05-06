package uuid

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
)

// GenerateRandomBytes is used to generate random bytes of given size.
func GenerateRandomBytes(size int) ([]byte, error) {
	return GenerateRandomBytesWithReader(size, rand.Reader)
}

// GenerateRandomBytesWithReader is used to generate random bytes of given size read from a given reader.
func GenerateRandomBytesWithReader(size int, reader io.Reader) ([]byte, error) {
	if reader == nil {
		return nil, fmt.Errorf("provided reader is nil")
	}
	buf := make([]byte, size)
	if _, err := io.ReadFull(reader, buf); err != nil {
		return nil, fmt.Errorf("failed to read random bytes: %v", err)
	}
	return buf, nil
}


const uuidLen = 16

// GenerateUUID is used to generate a random UUID
func GenerateUUID() (string, error) {
	return GenerateUUIDWithReader(rand.Reader)
}

// GenerateUUIDWithReader is used to generate a random UUID with a given Reader
func GenerateUUIDWithReader(reader io.Reader) (string, error) {
	if reader == nil {
		return "", fmt.Errorf("provided reader is nil")
	}
	buf, err := GenerateRandomBytesWithReader(uuidLen, reader)
	if err != nil {
		return "", err
	}
	return FormatUUID(buf)
}

func FormatUUID(buf []byte) (string, error) {
	if buflen := len(buf); buflen != uuidLen {
		return "", fmt.Errorf("wrong length byte slice (%d)", buflen)
	}

	return fmt.Sprintf("%x-%x-%x-%x-%x",
		buf[0:4],
		buf[4:6],
		buf[6:8],
		buf[8:10],
		buf[10:16]), nil
}

func ParseUUID(uuid string) ([]byte, error) {
	if len(uuid) != 2 * uuidLen + 4 {
		return nil, fmt.Errorf("uuid string is wrong length")
	}

	if uuid[8] != '-' ||
		uuid[13] != '-' ||
		uuid[18] != '-' ||
		uuid[23] != '-' {
		return nil, fmt.Errorf("uuid is improperly formatted")
	}

	hexStr := uuid[0:8] + uuid[9:13] + uuid[14:18] + uuid[19:23] + uuid[24:36]

	ret, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, err
	}
	if len(ret) != uuidLen {
		return nil, fmt.Errorf("decoded hex is the wrong length")
	}

	return ret, nil
}
