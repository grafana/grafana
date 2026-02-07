//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

// ChainedTokenCredentialOptions contains optional parameters for ChainedTokenCredential.
type ChainedTokenCredentialOptions struct {
	// RetrySources configures how the credential uses its sources. When true, the credential always attempts to
	// authenticate through each source in turn, stopping when one succeeds. When false, the credential authenticates
	// only through this first successful source--it never again tries the sources which failed.
	RetrySources bool
}

// ChainedTokenCredential links together multiple credentials and tries them sequentially when authenticating. By default,
// it tries all the credentials until one authenticates, after which it always uses that credential. For more information,
// see [ChainedTokenCredential overview].
//
// [ChainedTokenCredential overview]: https://aka.ms/azsdk/go/identity/credential-chains#chainedtokencredential-overview
type ChainedTokenCredential struct {
	cond                 *sync.Cond
	iterating            bool
	name                 string
	retrySources         bool
	sources              []azcore.TokenCredential
	successfulCredential azcore.TokenCredential
}

// NewChainedTokenCredential creates a ChainedTokenCredential. Pass nil for options to accept defaults.
func NewChainedTokenCredential(sources []azcore.TokenCredential, options *ChainedTokenCredentialOptions) (*ChainedTokenCredential, error) {
	if len(sources) == 0 {
		return nil, errors.New("sources must contain at least one TokenCredential")
	}
	for _, source := range sources {
		if source == nil { // cannot have a nil credential in the chain or else the application will panic when GetToken() is called on nil
			return nil, errors.New("sources cannot contain nil")
		}
		if mc, ok := source.(*ManagedIdentityCredential); ok {
			mc.mic.chained = true
		}
	}
	cp := make([]azcore.TokenCredential, len(sources))
	copy(cp, sources)
	if options == nil {
		options = &ChainedTokenCredentialOptions{}
	}
	return &ChainedTokenCredential{
		cond:         sync.NewCond(&sync.Mutex{}),
		name:         "ChainedTokenCredential",
		retrySources: options.RetrySources,
		sources:      cp,
	}, nil
}

// GetToken calls GetToken on the chained credentials in turn, stopping when one returns a token.
// This method is called automatically by Azure SDK clients.
func (c *ChainedTokenCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	if !c.retrySources {
		// ensure only one goroutine at a time iterates the sources and perhaps sets c.successfulCredential
		c.cond.L.Lock()
		for {
			if c.successfulCredential != nil {
				c.cond.L.Unlock()
				return c.successfulCredential.GetToken(ctx, opts)
			}
			if !c.iterating {
				c.iterating = true
				// allow other goroutines to wait while this one iterates
				c.cond.L.Unlock()
				break
			}
			c.cond.Wait()
		}
	}

	var (
		err                  error
		errs                 []error
		successfulCredential azcore.TokenCredential
		token                azcore.AccessToken
		unavailableErr       credentialUnavailable
	)
	for _, cred := range c.sources {
		token, err = cred.GetToken(ctx, opts)
		if err == nil {
			log.Writef(EventAuthentication, "%s authenticated with %s", c.name, extractCredentialName(cred))
			successfulCredential = cred
			break
		}
		errs = append(errs, err)
		// continue to the next source iff this one returned credentialUnavailableError
		if !errors.As(err, &unavailableErr) {
			break
		}
	}
	if c.iterating {
		c.cond.L.Lock()
		// this is nil when all credentials returned an error
		c.successfulCredential = successfulCredential
		c.iterating = false
		c.cond.L.Unlock()
		c.cond.Broadcast()
	}
	// err is the error returned by the last GetToken call. It will be nil when that call succeeds
	if err != nil {
		// return credentialUnavailableError iff all sources did so; return AuthenticationFailedError otherwise
		msg := createChainedErrorMessage(errs)
		var authFailedErr *AuthenticationFailedError
		switch {
		case errors.As(err, &authFailedErr):
			err = newAuthenticationFailedError(c.name, msg, authFailedErr.RawResponse)
			if af, ok := err.(*AuthenticationFailedError); ok {
				// stop Error() printing the response again; it's already in msg
				af.omitResponse = true
			}
		case errors.As(err, &unavailableErr):
			err = newCredentialUnavailableError(c.name, msg)
		default:
			res := getResponseFromError(err)
			err = newAuthenticationFailedError(c.name, msg, res)
		}
	}
	return token, err
}

func createChainedErrorMessage(errs []error) string {
	msg := "failed to acquire a token.\nAttempted credentials:"
	for _, err := range errs {
		msg += fmt.Sprintf("\n\t%s", strings.ReplaceAll(err.Error(), "\n", "\n\t\t"))
	}
	return msg
}

func extractCredentialName(credential azcore.TokenCredential) string {
	return strings.TrimPrefix(fmt.Sprintf("%T", credential), "*azidentity.")
}

var _ azcore.TokenCredential = (*ChainedTokenCredential)(nil)
