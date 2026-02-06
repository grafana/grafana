// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"encoding/base64"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/errorinfo"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/temporal"
)

// BearerTokenPolicy authorizes requests with bearer tokens acquired from a TokenCredential.
// It handles [Continuous Access Evaluation] (CAE) challenges. Clients needing to handle
// additional authentication challenges, or needing more control over authorization, should
// provide a [policy.AuthorizationHandler] in [policy.BearerTokenOptions].
//
// [Continuous Access Evaluation]: https://learn.microsoft.com/entra/identity/conditional-access/concept-continuous-access-evaluation
type BearerTokenPolicy struct {
	// mainResource is the resource to be retreived using the tenant specified in the credential
	mainResource *temporal.Resource[exported.AccessToken, acquiringResourceState]
	// the following fields are read-only
	authzHandler policy.AuthorizationHandler
	cred         exported.TokenCredential
	scopes       []string
	allowHTTP    bool
}

type acquiringResourceState struct {
	req *policy.Request
	p   *BearerTokenPolicy
	tro policy.TokenRequestOptions
}

// acquire acquires or updates the resource; only one
// thread/goroutine at a time ever calls this function
func acquire(state acquiringResourceState) (newResource exported.AccessToken, newExpiration time.Time, err error) {
	tk, err := state.p.cred.GetToken(&shared.ContextWithDeniedValues{Context: state.req.Raw().Context()}, state.tro)
	if err != nil {
		return exported.AccessToken{}, time.Time{}, err
	}
	return tk, tk.ExpiresOn, nil
}

// shouldRefresh determines whether the token should be refreshed. It's a variable so tests can replace it.
var shouldRefresh = func(tk exported.AccessToken, _ acquiringResourceState) bool {
	if tk.RefreshOn.IsZero() {
		return tk.ExpiresOn.Add(-5 * time.Minute).Before(time.Now())
	}
	// no offset in this case because the authority suggested a refresh window--between RefreshOn and ExpiresOn
	return tk.RefreshOn.Before(time.Now())
}

// NewBearerTokenPolicy creates a policy object that authorizes requests with bearer tokens.
// cred: an azcore.TokenCredential implementation such as a credential object from azidentity
// scopes: the list of permission scopes required for the token.
// opts: optional settings. Pass nil to accept default values; this is the same as passing a zero-value options.
func NewBearerTokenPolicy(cred exported.TokenCredential, scopes []string, opts *policy.BearerTokenOptions) *BearerTokenPolicy {
	if opts == nil {
		opts = &policy.BearerTokenOptions{}
	}
	ah := opts.AuthorizationHandler
	if ah.OnRequest == nil {
		// Set a default OnRequest that simply requests a token with the given scopes. OnChallenge
		// doesn't get a default so the policy can use a nil check to determine whether the caller
		// provided an implementation.
		ah.OnRequest = func(_ *policy.Request, authNZ func(policy.TokenRequestOptions) error) error {
			// authNZ sets EnableCAE: true in all cases, no need to duplicate that here
			return authNZ(policy.TokenRequestOptions{Scopes: scopes})
		}
	}
	mr := temporal.NewResourceWithOptions(acquire, temporal.ResourceOptions[exported.AccessToken, acquiringResourceState]{
		ShouldRefresh: shouldRefresh,
	})
	return &BearerTokenPolicy{
		authzHandler: ah,
		cred:         cred,
		scopes:       scopes,
		mainResource: mr,
		allowHTTP:    opts.InsecureAllowCredentialWithHTTP,
	}
}

// authenticateAndAuthorize returns a function which authorizes req with a token from the policy's credential
func (b *BearerTokenPolicy) authenticateAndAuthorize(req *policy.Request) func(policy.TokenRequestOptions) error {
	return func(tro policy.TokenRequestOptions) error {
		tro.EnableCAE = true
		as := acquiringResourceState{p: b, req: req, tro: tro}
		tk, err := b.mainResource.Get(as)
		if err != nil {
			// consider this error non-retriable because if it could be resolved by
			// retrying authentication, the credential would have done so already
			return errorinfo.NonRetriableError(err)
		}
		req.Raw().Header.Set(shared.HeaderAuthorization, shared.BearerTokenPrefix+tk.Token)
		return nil
	}
}

// Do authorizes a request with a bearer token
func (b *BearerTokenPolicy) Do(req *policy.Request) (*http.Response, error) {
	// skip adding the authorization header if no TokenCredential was provided.
	// this prevents a panic that might be hard to diagnose and allows testing
	// against http endpoints that don't require authentication.
	if b.cred == nil {
		return req.Next()
	}

	if err := checkHTTPSForAuth(req, b.allowHTTP); err != nil {
		return nil, err
	}

	err := b.authzHandler.OnRequest(req, b.authenticateAndAuthorize(req))
	if err != nil {
		return nil, errorinfo.NonRetriableError(err)
	}

	res, err := req.Next()
	if err != nil {
		return nil, err
	}

	res, err = b.handleChallenge(req, res, false)
	return res, err
}

// handleChallenge handles authentication challenges either directly (for CAE challenges) or by calling
// the AuthorizationHandler. It's a no-op when the response doesn't include an authentication challenge.
// It will recurse at most once, to handle a CAE challenge following a non-CAE challenge handled by the
// AuthorizationHandler.
func (b *BearerTokenPolicy) handleChallenge(req *policy.Request, res *http.Response, recursed bool) (*http.Response, error) {
	var err error
	if res.StatusCode == http.StatusUnauthorized {
		b.mainResource.Expire()
		if res.Header.Get(shared.HeaderWWWAuthenticate) != "" {
			caeChallenge, parseErr := parseCAEChallenge(res)
			if parseErr != nil {
				return res, parseErr
			}
			switch {
			case caeChallenge != nil:
				authNZ := func(tro policy.TokenRequestOptions) error {
					// Take the TokenRequestOptions provided by OnRequest and add the challenge claims. The value
					// will be empty at time of writing because CAE is the only feature involving claims. If in
					// the future some client needs to specify unrelated claims, this function may need to merge
					// them with the challenge claims.
					tro.Claims = caeChallenge.params["claims"]
					return b.authenticateAndAuthorize(req)(tro)
				}
				if err = b.authzHandler.OnRequest(req, authNZ); err == nil {
					if err = req.RewindBody(); err == nil {
						res, err = req.Next()
					}
				}
			case b.authzHandler.OnChallenge != nil && !recursed:
				if err = b.authzHandler.OnChallenge(req, res, b.authenticateAndAuthorize(req)); err == nil {
					if err = req.RewindBody(); err == nil {
						if res, err = req.Next(); err == nil {
							res, err = b.handleChallenge(req, res, true)
						}
					}
				} else {
					// don't retry challenge handling errors
					err = errorinfo.NonRetriableError(err)
				}
			default:
				// return the response to the pipeline
			}
		}
	}
	return res, err
}

func checkHTTPSForAuth(req *policy.Request, allowHTTP bool) error {
	if strings.ToLower(req.Raw().URL.Scheme) != "https" && !allowHTTP {
		return errorinfo.NonRetriableError(errors.New("authenticated requests are not permitted for non TLS protected (https) endpoints"))
	}
	return nil
}

// parseCAEChallenge returns a *authChallenge representing Response's CAE challenge (nil when Response has none).
// If Response includes a CAE challenge having invalid claims, it returns a NonRetriableError.
func parseCAEChallenge(res *http.Response) (*authChallenge, error) {
	var (
		caeChallenge *authChallenge
		err          error
	)
	for _, c := range parseChallenges(res) {
		if c.scheme == "Bearer" {
			if claims := c.params["claims"]; claims != "" && c.params["error"] == "insufficient_claims" {
				if b, de := base64.StdEncoding.DecodeString(claims); de == nil {
					c.params["claims"] = string(b)
					caeChallenge = &c
				} else {
					// don't include the decoding error because it's something
					// unhelpful like "illegal base64 data at input byte 42"
					err = errorinfo.NonRetriableError(errors.New("authentication challenge contains invalid claims: " + claims))
				}
				break
			}
		}
	}
	return caeChallenge, err
}

var (
	challenge, challengeParams *regexp.Regexp
	once                       = &sync.Once{}
)

type authChallenge struct {
	scheme string
	params map[string]string
}

// parseChallenges assumes authentication challenges have quoted parameter values
func parseChallenges(res *http.Response) []authChallenge {
	once.Do(func() {
		// matches challenges having quoted parameters, capturing scheme and parameters
		challenge = regexp.MustCompile(`(?:(\w+) ((?:\w+="[^"]*",?\s*)+))`)
		// captures parameter names and values in a match of the above expression
		challengeParams = regexp.MustCompile(`(\w+)="([^"]*)"`)
	})
	parsed := []authChallenge{}
	// WWW-Authenticate can have multiple values, each containing multiple challenges
	for _, h := range res.Header.Values(shared.HeaderWWWAuthenticate) {
		for _, sm := range challenge.FindAllStringSubmatch(h, -1) {
			// sm is [challenge, scheme, params] (see regexp documentation on submatches)
			c := authChallenge{
				params: make(map[string]string),
				scheme: sm[1],
			}
			for _, sm := range challengeParams.FindAllStringSubmatch(sm[2], -1) {
				// sm is [key="value", key, value] (see regexp documentation on submatches)
				c.params[sm[1]] = sm[2]
			}
			parsed = append(parsed, c)
		}
	}
	return parsed
}
