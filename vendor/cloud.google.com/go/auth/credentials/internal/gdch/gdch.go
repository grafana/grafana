// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package gdch

import (
	"context"
	"crypto"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/internal"
	"cloud.google.com/go/auth/internal/credsfile"
	"cloud.google.com/go/auth/internal/jwt"
	"github.com/googleapis/gax-go/v2/internallog"
)

const (
	// GrantType is the grant type for the token request.
	GrantType        = "urn:ietf:params:oauth:token-type:token-exchange"
	requestTokenType = "urn:ietf:params:oauth:token-type:access_token"
	subjectTokenType = "urn:k8s:params:oauth:token-type:serviceaccount"
)

var (
	gdchSupportFormatVersions map[string]bool = map[string]bool{
		"1": true,
	}
)

// Options for [NewTokenProvider].
type Options struct {
	STSAudience string
	Client      *http.Client
	Logger      *slog.Logger
}

// NewTokenProvider returns a [cloud.google.com/go/auth.TokenProvider] from a
// GDCH cred file.
func NewTokenProvider(f *credsfile.GDCHServiceAccountFile, o *Options) (auth.TokenProvider, error) {
	if !gdchSupportFormatVersions[f.FormatVersion] {
		return nil, fmt.Errorf("credentials: unsupported gdch_service_account format %q", f.FormatVersion)
	}
	if o.STSAudience == "" {
		return nil, errors.New("credentials: STSAudience must be set for the GDCH auth flows")
	}
	signer, err := internal.ParseKey([]byte(f.PrivateKey))
	if err != nil {
		return nil, err
	}
	certPool, err := loadCertPool(f.CertPath)
	if err != nil {
		return nil, err
	}

	tp := gdchProvider{
		serviceIdentity: fmt.Sprintf("system:serviceaccount:%s:%s", f.Project, f.Name),
		tokenURL:        f.TokenURL,
		aud:             o.STSAudience,
		signer:          signer,
		pkID:            f.PrivateKeyID,
		certPool:        certPool,
		client:          o.Client,
		logger:          internallog.New(o.Logger),
	}
	return tp, nil
}

func loadCertPool(path string) (*x509.CertPool, error) {
	pool := x509.NewCertPool()
	pem, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("credentials: failed to read certificate: %w", err)
	}
	pool.AppendCertsFromPEM(pem)
	return pool, nil
}

type gdchProvider struct {
	serviceIdentity string
	tokenURL        string
	aud             string
	signer          crypto.Signer
	pkID            string
	certPool        *x509.CertPool

	client *http.Client
	logger *slog.Logger
}

func (g gdchProvider) Token(ctx context.Context) (*auth.Token, error) {
	addCertToTransport(g.client, g.certPool)
	iat := time.Now()
	exp := iat.Add(time.Hour)
	claims := jwt.Claims{
		Iss: g.serviceIdentity,
		Sub: g.serviceIdentity,
		Aud: g.tokenURL,
		Iat: iat.Unix(),
		Exp: exp.Unix(),
	}
	h := jwt.Header{
		Algorithm: jwt.HeaderAlgRSA256,
		Type:      jwt.HeaderType,
		KeyID:     string(g.pkID),
	}
	payload, err := jwt.EncodeJWS(&h, &claims, g.signer)
	if err != nil {
		return nil, err
	}
	v := url.Values{}
	v.Set("grant_type", GrantType)
	v.Set("audience", g.aud)
	v.Set("requested_token_type", requestTokenType)
	v.Set("subject_token", payload)
	v.Set("subject_token_type", subjectTokenType)

	req, err := http.NewRequestWithContext(ctx, "POST", g.tokenURL, strings.NewReader(v.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	g.logger.DebugContext(ctx, "gdch token request", "request", internallog.HTTPRequest(req, []byte(v.Encode())))
	resp, body, err := internal.DoRequest(g.client, req)
	if err != nil {
		return nil, fmt.Errorf("credentials: cannot fetch token: %w", err)
	}
	g.logger.DebugContext(ctx, "gdch token response", "response", internallog.HTTPResponse(resp, body))
	if c := resp.StatusCode; c < http.StatusOK || c > http.StatusMultipleChoices {
		return nil, &auth.Error{
			Response: resp,
			Body:     body,
		}
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int64  `json:"expires_in"` // relative seconds from now
	}
	if err := json.Unmarshal(body, &tokenRes); err != nil {
		return nil, fmt.Errorf("credentials: cannot fetch token: %w", err)
	}
	token := &auth.Token{
		Value: tokenRes.AccessToken,
		Type:  tokenRes.TokenType,
	}
	raw := make(map[string]interface{})
	json.Unmarshal(body, &raw) // no error checks for optional fields
	token.Metadata = raw

	if secs := tokenRes.ExpiresIn; secs > 0 {
		token.Expiry = time.Now().Add(time.Duration(secs) * time.Second)
	}
	return token, nil
}

// addCertToTransport makes a best effort attempt at adding in the cert info to
// the client. It tries to keep all configured transport settings if the
// underlying transport is an http.Transport. Or else it overwrites the
// transport with defaults adding in the certs.
func addCertToTransport(hc *http.Client, certPool *x509.CertPool) {
	trans, ok := hc.Transport.(*http.Transport)
	if !ok {
		trans = http.DefaultTransport.(*http.Transport).Clone()
	}
	trans.TLSClientConfig = &tls.Config{
		RootCAs: certPool,
	}
}
