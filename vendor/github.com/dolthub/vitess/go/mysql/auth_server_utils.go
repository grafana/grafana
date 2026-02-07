/*
Copyright ApeCloud, Inc.
Licensed under the Apache v2(found in the LICENSE file in the root directory).
*/

// NOTE: The logic in SerializeCachingSha2PasswordAuthString, and the b64From24bit and sha256Hash functions
//       were taken from the wesql/wescale project (https://github.com/wesql/wescale) and is copyright ApeCloud, Inc.
//       All other code in this file is copyright DoltHub, Inc.

package mysql

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"strconv"
)

const (
	// DefaultCachingSha2PasswordHashIterations is the default number of hashing iterations used (before the
	// iterationMultiplier is applied) when hashing a password using the caching_sha2_password auth plugin.
	DefaultCachingSha2PasswordHashIterations = 5

	// mixChars is the number of characters to use in the mix
	mixChars = 32

	// iterationMultiplier is the multiplier applied to the number of hashing iterations the user has requested.
	// For example, if the user requests 10 iterations, the actual number of iterations will be 10 * iterationMultiplier.
	iterationMultiplier = 1000

	// delimiter is used to separate the metadata fields in a caching_sha2_password authentication string.
	delimiter = '$'

	// saltLength is the length of the salt used in the caching_sha2_password authentication protocol.
	saltLength = 20

	// storedSha256DigestLength is the length of the base64 encoded sha256 digest in an auth string
	storedSha256DigestLength = 43

	// maxIterations is the maximum iterations (before the iterationMultiplier is applied) that can be used
	// in the hasing process for the caching_sha2_password auth plugin. The iterations applied are not directly
	// user-controllable, so realistically, this limit can't be breached.
	maxIterations = 0xFFF
)

// DeserializeCachingSha2PasswordAuthString takes in |authStringBytes|, a caching_sha2_password auth plugin generated
// authentication string, and parses out the individual components: the digest type, number of iterations, salt, and
// the password hash. |iterations| is the number of iterations the hashing function has been through (not including
// the internal iteration multiplier, 1,000). If any errors are encountered during parsing, such as the authentication
// string bytes not having the expected format, an error is returned.
//
// The protocol for generating an auth string for the caching_sha2_password plugin is not documented, but the MySQL
// source code can be found here: https://github.com/mysql/mysql-server/blob/trunk/sql/auth/sha2_password.cc#L440
func DeserializeCachingSha2PasswordAuthString(authStringBytes []byte) (digestType string, iterations int, salt, digest []byte, err error) {
	if authStringBytes[0] != delimiter {
		return "", 0, nil, nil, fmt.Errorf(
			"authentication string does not start with the expected delimiter '$'")
	}

	// Digest Type
	digestTypeCode := authStringBytes[1]
	switch digestTypeCode {
	case 'A':
		digestType = "SHA256"
	default:
		return "", 0, nil, nil, fmt.Errorf(
			"unsupported digest type: %v", digestTypeCode)
	}

	// Validate the delimiter
	if authStringBytes[2] != delimiter {
		return "", 0, nil, nil, fmt.Errorf(
			"authentication string does not contain with the expected delimiter '$' between digest type and iterations")
	}

	// Iterations
	iterationsString := string(authStringBytes[3:6])
	iterations32bit, err := strconv.ParseInt(iterationsString, 16, 32)
	if err != nil {
		return "", 0, nil, nil, fmt.Errorf(
			"iterations specified in authentication string is not a valid integer: %v", iterationsString)
	}
	iterations = int(iterations32bit)

	// Validate the delimiter
	if authStringBytes[6] != delimiter {
		return "", 0, nil, nil, fmt.Errorf(
			"authentication string does not contain with the expected delimiter '$' between iterations and salt")
	}

	// Salt
	salt = authStringBytes[7 : 7+saltLength]

	// Digest
	digest = authStringBytes[7+saltLength:]
	if len(digest) != storedSha256DigestLength {
		return "", 0, nil, nil, fmt.Errorf("Unexpected digest length: %v", len(digest))
	}

	return digestType, iterations, salt, digest, nil
}

// SerializeCachingSha2PasswordAuthString uses SHA256 hashing algorithm to hash a plaintext password (|plaintext|)
// with the specified |salt|. The hashing is repeated |iterations| times. Note that |iterations| is the external,
// user-controllable number of iterations BEFORE the iterations multipler (i.e. 1000) is applied. The return bytes
// represent an authentication string compatible with the caching_sha2_password plugin authentication method.
func SerializeCachingSha2PasswordAuthString(plaintext string, salt []byte, iterations int) ([]byte, error) {
	if iterations > maxIterations {
		return nil, fmt.Errorf("iterations value (%d) is greater than max allowed iterations (%d)", iterations, maxIterations)
	}

	// 1, 2, 3
	bufA := bytes.NewBuffer(make([]byte, 0, 4096))
	bufA.WriteString(plaintext)
	bufA.Write(salt)

	// 4, 5, 6, 7, 8
	bufB := bytes.NewBuffer(make([]byte, 0, 4096))
	bufB.WriteString(plaintext)
	bufB.Write(salt)
	bufB.WriteString(plaintext)
	sumB := sha256Hash(bufB.Bytes())
	bufB.Reset()

	// 9, 10
	var i int
	for i = len(plaintext); i > mixChars; i -= mixChars {
		bufA.Write(sumB[:mixChars])
	}
	bufA.Write(sumB[:i])
	// 11
	for i = len(plaintext); i > 0; i >>= 1 {
		if i%2 == 0 {
			bufA.WriteString(plaintext)
		} else {
			bufA.Write(sumB[:])
		}
	}

	// 12
	sumA := sha256Hash(bufA.Bytes())
	bufA.Reset()

	// 13, 14, 15
	bufDP := bufA
	for range []byte(plaintext) {
		bufDP.WriteString(plaintext)
	}
	sumDP := sha256Hash(bufDP.Bytes())
	bufDP.Reset()

	// 16
	p := make([]byte, 0, sha256.Size)
	for i = len(plaintext); i > 0; i -= mixChars {
		if i > mixChars {
			p = append(p, sumDP[:]...)
		} else {
			p = append(p, sumDP[0:i]...)
		}
	}
	// 17, 18, 19
	bufDS := bufA
	for i = 0; i < 16+int(sumA[0]); i++ {
		bufDS.Write(salt)
	}
	sumDS := sha256Hash(bufDS.Bytes())
	bufDS.Reset()

	// 20
	s := make([]byte, 0, 32)
	for i = len(salt); i > 0; i -= mixChars {
		if i > mixChars {
			s = append(s, sumDS[:]...)
		} else {
			s = append(s, sumDS[0:i]...)
		}
	}

	// 21
	bufC := bufA
	var sumC []byte
	for i = 0; i < iterations*iterationMultiplier; i++ {
		bufC.Reset()
		if i&1 != 0 {
			bufC.Write(p)
		} else {
			bufC.Write(sumA[:])
		}
		if i%3 != 0 {
			bufC.Write(s)
		}
		if i%7 != 0 {
			bufC.Write(p)
		}
		if i&1 != 0 {
			bufC.Write(sumA[:])
		} else {
			bufC.Write(p)
		}
		sumC = sha256Hash(bufC.Bytes())
		sumA = sumC
	}
	// 22
	buf := bytes.NewBuffer(make([]byte, 0, 100))
	buf.Write([]byte{'$', 'A', '$'})
	rounds := fmt.Sprintf("%03X", iterations)
	buf.WriteString(rounds)
	buf.Write([]byte{'$'})
	buf.Write(salt)

	b64From24bit([]byte{sumC[0], sumC[10], sumC[20]}, 4, buf)
	b64From24bit([]byte{sumC[21], sumC[1], sumC[11]}, 4, buf)
	b64From24bit([]byte{sumC[12], sumC[22], sumC[2]}, 4, buf)
	b64From24bit([]byte{sumC[3], sumC[13], sumC[23]}, 4, buf)
	b64From24bit([]byte{sumC[24], sumC[4], sumC[14]}, 4, buf)
	b64From24bit([]byte{sumC[15], sumC[25], sumC[5]}, 4, buf)
	b64From24bit([]byte{sumC[6], sumC[16], sumC[26]}, 4, buf)
	b64From24bit([]byte{sumC[27], sumC[7], sumC[17]}, 4, buf)
	b64From24bit([]byte{sumC[18], sumC[28], sumC[8]}, 4, buf)
	b64From24bit([]byte{sumC[9], sumC[19], sumC[29]}, 4, buf)
	b64From24bit([]byte{0, sumC[31], sumC[30]}, 3, buf)

	return []byte(buf.String()), nil
}

// sha256Hash is a util function to calculate a sha256 hash.
func sha256Hash(input []byte) []byte {
	res := sha256.Sum256(input)
	return res[:]
}

// b64From24bit is a util function to base64 encode up to 24 bits at a time (|n|) from the
// byte slice |b| and writes the encoded data to |buf|.
func b64From24bit(b []byte, n int, buf *bytes.Buffer) {
	b64t := []byte("./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")

	w := (int64(b[0]) << 16) | (int64(b[1]) << 8) | int64(b[2])
	for n > 0 {
		n--
		buf.WriteByte(b64t[w&0x3f])
		w >>= 6
	}
}
