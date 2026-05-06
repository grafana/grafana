//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"errors"
	"time"
)

// cliTimeout is the default timeout for authentication attempts via CLI tools
const cliTimeout = 10 * time.Second

// unavailableIfInChain returns err or, if the credential was invoked by DefaultAzureCredential, a
// credentialUnavailableError having the same message. This ensures DefaultAzureCredential will try
// the next credential in its chain (another developer credential).
func unavailableIfInChain(err error, inDefaultChain bool) error {
	if err != nil && inDefaultChain {
		var unavailableErr credentialUnavailable
		if !errors.As(err, &unavailableErr) {
			err = newCredentialUnavailableError(credNameAzureDeveloperCLI, err.Error())
		}
	}
	return err
}

// validScope is for credentials authenticating via external tools. The authority validates scopes for all other credentials.
func validScope(scope string) bool {
	for _, r := range scope {
		if !(alphanumeric(r) || r == '.' || r == '-' || r == '_' || r == '/' || r == ':') {
			return false
		}
	}
	return true
}
