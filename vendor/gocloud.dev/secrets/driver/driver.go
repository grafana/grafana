// Copyright 2018 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package driver defines interfaces to be implemented by secrets drivers, which
// will be used by the secrets package to interact with the underlying services.
// Application code should use package secrets.
package driver // import "gocloud.dev/secrets/driver"

import (
	"context"

	"gocloud.dev/gcerrors"
)

// Keeper holds the key information to encrypt a plain text message into a
// cipher message, as well as decrypt a cipher message into a plain text
// message.
type Keeper interface {
	// Decrypt decrypts the ciphertext and returns the plaintext or an error.
	// Decrypt *may* decrypt ciphertexts that were encrypted using a different
	// key than the one provided to Keeper; some drivers encode the key used
	// in the ciphertext.
	Decrypt(ctx context.Context, ciphertext []byte) ([]byte, error)

	// Encrypt encrypts the plaintext using the key, and returns the ciphertext.
	Encrypt(ctx context.Context, plaintext []byte) ([]byte, error)

	// Close releases any resources used for the Keeper.
	Close() error

	// ErrorAs allows drivers to expose driver-specific types for returned
	// errors.
	//
	// See https://gocloud.dev/concepts/as/ for background information.
	ErrorAs(err error, i any) bool

	// ErrorCode should return a code that describes the error, which was returned
	// by one of the other methods in this interface.
	ErrorCode(error) gcerrors.ErrorCode
}
