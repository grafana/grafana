// Copyright 2021 The CUE Authors
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

package ed25519

import (
	"crypto/ed25519"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

const (
	// PublicKeySize is the size of a public key in bytes.
	PublicKeySize = 32
)

// Valid verifies the provided signature of the message using the public key.
// An error is returned if and only if an invalid public key is provided.
func Valid(publicKey, message, signature []byte) (bool, error) {
	if size := len(publicKey); size != PublicKeySize {
		return false, errors.Newf(token.NoPos, "ed25519: publicKey must be 32 bytes")
	}
	return ed25519.Verify(publicKey, message, signature), nil
}
