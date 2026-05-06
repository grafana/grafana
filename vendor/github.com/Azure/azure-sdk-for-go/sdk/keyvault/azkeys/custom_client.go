//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package azkeys

// this file contains handwritten additions to the generated code

import (
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/keyvault/internal"
)

// ClientOptions contains optional settings for Client.
type ClientOptions struct {
	azcore.ClientOptions

	// DisableChallengeResourceVerification controls whether the policy requires the
	// authentication challenge resource to match the Key Vault or Managed HSM domain.
	// See https://aka.ms/azsdk/blog/vault-uri for more information.
	DisableChallengeResourceVerification bool
}

// NewClient creates a client that accesses a Key Vault's keys. You should validate that vaultURL
// references a valid Key Vault or Managed HSM. See https://aka.ms/azsdk/blog/vault-uri for details.
func NewClient(vaultURL string, credential azcore.TokenCredential, options *ClientOptions) (*Client, error) {
	if options == nil {
		options = &ClientOptions{}
	}
	authPolicy := internal.NewKeyVaultChallengePolicy(
		credential,
		&internal.KeyVaultChallengePolicyOptions{
			DisableChallengeResourceVerification: options.DisableChallengeResourceVerification,
		},
	)
	azcoreClient, err := azcore.NewClient("azkeys.Client", version, runtime.PipelineOptions{PerRetry: []policy.Policy{authPolicy}}, &options.ClientOptions)
	if err != nil {
		return nil, err
	}
	return &Client{endpoint: vaultURL, internal: azcoreClient}, nil
}

// ID is a key's unique ID, containing its version, if any, and name.
type ID string

// Name of the key.
func (i *ID) Name() string {
	_, name, _ := internal.ParseID((*string)(i))
	return *name
}

// Version of the key. This returns an empty string when the ID contains no version.
func (i *ID) Version() string {
	_, _, version := internal.ParseID((*string)(i))
	if version == nil {
		return ""
	}
	return *version
}
