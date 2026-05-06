// Copyright 2021 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package hmac implements the Keyed-Hash Message Authentication Code (HMAC) as
// defined in U.S. Federal Information Processing Standards Publication 198.
//
// An HMAC is a cryptographic hash that uses a key to sign a message.
// The receiver verifies the hash by recomputing it using the same key.
package hmac

import (
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"fmt"
	"hash"
)

const (
	MD5        = "MD5"
	SHA1       = "SHA1"
	SHA224     = "SHA224"
	SHA256     = "SHA256"
	SHA384     = "SHA384"
	SHA512     = "SHA512"
	SHA512_224 = "SHA512_224"
	SHA512_256 = "SHA512_256"
)

// Sign returns the HMAC signature of the data, using the provided key and hash function.
//
// Supported hash functions: "MD5", "SHA1", "SHA224", "SHA256", "SHA384", "SHA512", "SHA512_224",
// and "SHA512_256".
func Sign(hashName string, key []byte, data []byte) ([]byte, error) {
	hash, err := hashFromName(hashName)
	if err != nil {
		return nil, err
	}
	mac := hmac.New(hash, key)
	mac.Write(data)
	return mac.Sum(nil), nil
}

func hashFromName(hash string) (func() hash.Hash, error) {
	switch hash {
	case MD5:
		return md5.New, nil
	case SHA1:
		return sha1.New, nil
	case SHA224:
		return sha256.New224, nil
	case SHA256:
		return sha256.New, nil
	case SHA384:
		return sha512.New384, nil
	case SHA512:
		return sha512.New, nil
	case SHA512_224:
		return sha512.New512_224, nil
	case SHA512_256:
		return sha512.New512_256, nil
	}
	return nil, fmt.Errorf("unsupported hash function")
}
