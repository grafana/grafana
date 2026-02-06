// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package security

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-openapi/errors"

	"github.com/go-openapi/runtime"
)

const (
	query            = "query"
	header           = "header"
	accessTokenParam = "access_token"
)

// HttpAuthenticator is a function that authenticates a HTTP request
func HttpAuthenticator(handler func(*http.Request) (bool, interface{}, error)) runtime.Authenticator { //nolint:revive,stylecheck
	return runtime.AuthenticatorFunc(func(params interface{}) (bool, interface{}, error) {
		if request, ok := params.(*http.Request); ok {
			return handler(request)
		}
		if scoped, ok := params.(*ScopedAuthRequest); ok {
			return handler(scoped.Request)
		}
		return false, nil, nil
	})
}

// ScopedAuthenticator is a function that authenticates a HTTP request against a list of valid scopes
func ScopedAuthenticator(handler func(*ScopedAuthRequest) (bool, interface{}, error)) runtime.Authenticator {
	return runtime.AuthenticatorFunc(func(params interface{}) (bool, interface{}, error) {
		if request, ok := params.(*ScopedAuthRequest); ok {
			return handler(request)
		}
		return false, nil, nil
	})
}

// UserPassAuthentication authentication function
type UserPassAuthentication func(string, string) (interface{}, error)

// UserPassAuthenticationCtx authentication function with context.Context
type UserPassAuthenticationCtx func(context.Context, string, string) (context.Context, interface{}, error)

// TokenAuthentication authentication function
type TokenAuthentication func(string) (interface{}, error)

// TokenAuthenticationCtx authentication function with context.Context
type TokenAuthenticationCtx func(context.Context, string) (context.Context, interface{}, error)

// ScopedTokenAuthentication authentication function
type ScopedTokenAuthentication func(string, []string) (interface{}, error)

// ScopedTokenAuthenticationCtx authentication function with context.Context
type ScopedTokenAuthenticationCtx func(context.Context, string, []string) (context.Context, interface{}, error)

var DefaultRealmName = "API"

type secCtxKey uint8

const (
	failedBasicAuth secCtxKey = iota
	oauth2SchemeName
)

func FailedBasicAuth(r *http.Request) string {
	return FailedBasicAuthCtx(r.Context())
}

func FailedBasicAuthCtx(ctx context.Context) string {
	v, ok := ctx.Value(failedBasicAuth).(string)
	if !ok {
		return ""
	}
	return v
}

func OAuth2SchemeName(r *http.Request) string {
	return OAuth2SchemeNameCtx(r.Context())
}

func OAuth2SchemeNameCtx(ctx context.Context) string {
	v, ok := ctx.Value(oauth2SchemeName).(string)
	if !ok {
		return ""
	}
	return v
}

// BasicAuth creates a basic auth authenticator with the provided authentication function
func BasicAuth(authenticate UserPassAuthentication) runtime.Authenticator {
	return BasicAuthRealm(DefaultRealmName, authenticate)
}

// BasicAuthRealm creates a basic auth authenticator with the provided authentication function and realm name
func BasicAuthRealm(realm string, authenticate UserPassAuthentication) runtime.Authenticator {
	if realm == "" {
		realm = DefaultRealmName
	}

	return HttpAuthenticator(func(r *http.Request) (bool, interface{}, error) {
		if usr, pass, ok := r.BasicAuth(); ok {
			p, err := authenticate(usr, pass)
			if err != nil {
				*r = *r.WithContext(context.WithValue(r.Context(), failedBasicAuth, realm))
			}
			return true, p, err
		}
		*r = *r.WithContext(context.WithValue(r.Context(), failedBasicAuth, realm))
		return false, nil, nil
	})
}

// BasicAuthCtx creates a basic auth authenticator with the provided authentication function with support for context.Context
func BasicAuthCtx(authenticate UserPassAuthenticationCtx) runtime.Authenticator {
	return BasicAuthRealmCtx(DefaultRealmName, authenticate)
}

// BasicAuthRealmCtx creates a basic auth authenticator with the provided authentication function and realm name with support for context.Context
func BasicAuthRealmCtx(realm string, authenticate UserPassAuthenticationCtx) runtime.Authenticator {
	if realm == "" {
		realm = DefaultRealmName
	}

	return HttpAuthenticator(func(r *http.Request) (bool, interface{}, error) {
		if usr, pass, ok := r.BasicAuth(); ok {
			ctx, p, err := authenticate(r.Context(), usr, pass)
			if err != nil {
				ctx = context.WithValue(ctx, failedBasicAuth, realm)
			}
			*r = *r.WithContext(ctx)
			return true, p, err
		}
		*r = *r.WithContext(context.WithValue(r.Context(), failedBasicAuth, realm))
		return false, nil, nil
	})
}

// APIKeyAuth creates an authenticator that uses a token for authorization.
// This token can be obtained from either a header or a query string
func APIKeyAuth(name, in string, authenticate TokenAuthentication) runtime.Authenticator {
	inl := strings.ToLower(in)
	if inl != query && inl != header {
		// panic because this is most likely a typo
		panic(errors.New(500, "api key auth: in value needs to be either \"query\" or \"header\""))
	}

	var getToken func(*http.Request) string
	switch inl {
	case header:
		getToken = func(r *http.Request) string { return r.Header.Get(name) }
	case query:
		getToken = func(r *http.Request) string { return r.URL.Query().Get(name) }
	}

	return HttpAuthenticator(func(r *http.Request) (bool, interface{}, error) {
		token := getToken(r)
		if token == "" {
			return false, nil, nil
		}

		p, err := authenticate(token)
		return true, p, err
	})
}

// APIKeyAuthCtx creates an authenticator that uses a token for authorization with support for context.Context.
// This token can be obtained from either a header or a query string
func APIKeyAuthCtx(name, in string, authenticate TokenAuthenticationCtx) runtime.Authenticator {
	inl := strings.ToLower(in)
	if inl != query && inl != header {
		// panic because this is most likely a typo
		panic(errors.New(500, "api key auth: in value needs to be either \"query\" or \"header\""))
	}

	var getToken func(*http.Request) string
	switch inl {
	case header:
		getToken = func(r *http.Request) string { return r.Header.Get(name) }
	case query:
		getToken = func(r *http.Request) string { return r.URL.Query().Get(name) }
	}

	return HttpAuthenticator(func(r *http.Request) (bool, interface{}, error) {
		token := getToken(r)
		if token == "" {
			return false, nil, nil
		}

		ctx, p, err := authenticate(r.Context(), token)
		*r = *r.WithContext(ctx)
		return true, p, err
	})
}

// ScopedAuthRequest contains both a http request and the required scopes for a particular operation
type ScopedAuthRequest struct {
	Request        *http.Request
	RequiredScopes []string
}

// BearerAuth for use with oauth2 flows
func BearerAuth(name string, authenticate ScopedTokenAuthentication) runtime.Authenticator {
	const prefix = "Bearer "
	return ScopedAuthenticator(func(r *ScopedAuthRequest) (bool, interface{}, error) {
		var token string
		hdr := r.Request.Header.Get(runtime.HeaderAuthorization)
		if strings.HasPrefix(hdr, prefix) {
			token = strings.TrimPrefix(hdr, prefix)
		}
		if token == "" {
			qs := r.Request.URL.Query()
			token = qs.Get(accessTokenParam)
		}
		//#nosec
		ct, _, _ := runtime.ContentType(r.Request.Header)
		if token == "" && (ct == "application/x-www-form-urlencoded" || ct == "multipart/form-data") {
			token = r.Request.FormValue(accessTokenParam)
		}

		if token == "" {
			return false, nil, nil
		}

		rctx := context.WithValue(r.Request.Context(), oauth2SchemeName, name)
		*r.Request = *r.Request.WithContext(rctx)
		p, err := authenticate(token, r.RequiredScopes)
		return true, p, err
	})
}

// BearerAuthCtx for use with oauth2 flows with support for context.Context.
func BearerAuthCtx(name string, authenticate ScopedTokenAuthenticationCtx) runtime.Authenticator {
	const prefix = "Bearer "
	return ScopedAuthenticator(func(r *ScopedAuthRequest) (bool, interface{}, error) {
		var token string
		hdr := r.Request.Header.Get(runtime.HeaderAuthorization)
		if strings.HasPrefix(hdr, prefix) {
			token = strings.TrimPrefix(hdr, prefix)
		}
		if token == "" {
			qs := r.Request.URL.Query()
			token = qs.Get(accessTokenParam)
		}
		//#nosec
		ct, _, _ := runtime.ContentType(r.Request.Header)
		if token == "" && (ct == "application/x-www-form-urlencoded" || ct == "multipart/form-data") {
			token = r.Request.FormValue(accessTokenParam)
		}

		if token == "" {
			return false, nil, nil
		}

		rctx := context.WithValue(r.Request.Context(), oauth2SchemeName, name)
		ctx, p, err := authenticate(rctx, token, r.RequiredScopes)
		*r.Request = *r.Request.WithContext(ctx)
		return true, p, err
	})
}
