package util

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"strings"
)

// Md5Sum calculates the md5sum of a stream
func Md5Sum(reader io.Reader) (string, error) {
	var returnMD5String string
	hash := md5.New()
	if _, err := io.Copy(hash, reader); err != nil {
		return returnMD5String, err
	}
	hashInBytes := hash.Sum(nil)[:16]
	returnMD5String = hex.EncodeToString(hashInBytes)
	return returnMD5String, nil
}

// Md5Sum calculates the md5sum of a string
func Md5SumString(input string) (string, error) {
	buffer := strings.NewReader(input)
	return Md5Sum(buffer)
}
