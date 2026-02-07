// Copyright 2020 The Go Cloud Development Kit Authors
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

// This is an implementation for Options.MakeSignBytes
// that serves as example for how to keep a private key in a separate
// process, service, or HSM/TPM, yet use it as signer for blob.Bucket.

package gcsblob

import (
	"context"
	"sync"

	credentials "cloud.google.com/go/iam/credentials/apiv1"
	"cloud.google.com/go/iam/credentials/apiv1/credentialspb"
	gax "github.com/googleapis/gax-go/v2"
)

// credentialsClient wraps the IAM Credentials API client for a lazy initialization
// and expresses it in the reduced format expected by SignBytes.
// See https://cloud.google.com/iam/docs/reference/credentials/rest
type credentialsClient struct {
	init sync.Once
	err  error

	// client as reduced surface of credentials.IamCredentialsClient
	// enables us to use a mock in tests.
	client interface {
		SignBlob(context.Context, *credentialspb.SignBlobRequest, ...gax.CallOption) (*credentialspb.SignBlobResponse, error)
	}
}

// CreateMakeSignBytesWith produces a MakeSignBytes variant from an expanded parameter set.
// It essentially adapts a remote call to the IAM Credentials API
// to the function signature expected by storage.SignedURLOptions.SignBytes.
func (c *credentialsClient) CreateMakeSignBytesWith(lifetimeCtx context.Context, googleAccessID string) func(context.Context) SignBytesFunc {
	return func(requestCtx context.Context) SignBytesFunc {
		c.init.Do(func() {
			if c.client != nil {
				// Set previously, likely to a mock implementation for tests.
				return
			}
			c.client, c.err = credentials.NewIamCredentialsClient(lifetimeCtx)
		})

		return func(p []byte) ([]byte, error) {
			if c.err != nil {
				return nil, c.err
			}

			resp, err := c.client.SignBlob(
				requestCtx,
				&credentialspb.SignBlobRequest{
					Name:    googleAccessID,
					Payload: p,
				})
			if err != nil {
				return nil, err
			}
			return resp.GetSignedBlob(), nil
		}
	}
}
