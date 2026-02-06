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

package credentials

import (
	"context"
	"crypto"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/internal"
	"cloud.google.com/go/auth/internal/credsfile"
	"cloud.google.com/go/auth/internal/jwt"
)

var (
	// for testing
	now func() time.Time = time.Now
)

// configureSelfSignedJWT uses the private key in the service account to create
// a JWT without making a network call.
func configureSelfSignedJWT(f *credsfile.ServiceAccountFile, opts *DetectOptions) (auth.TokenProvider, error) {
	if len(opts.scopes()) == 0 && opts.Audience == "" {
		return nil, errors.New("credentials: both scopes and audience are empty")
	}
	signer, err := internal.ParseKey([]byte(f.PrivateKey))
	if err != nil {
		return nil, fmt.Errorf("credentials: could not parse key: %w", err)
	}
	return &selfSignedTokenProvider{
		email:    f.ClientEmail,
		audience: opts.Audience,
		scopes:   opts.scopes(),
		signer:   signer,
		pkID:     f.PrivateKeyID,
		logger:   opts.logger(),
	}, nil
}

type selfSignedTokenProvider struct {
	email    string
	audience string
	scopes   []string
	signer   crypto.Signer
	pkID     string
	logger   *slog.Logger
}

func (tp *selfSignedTokenProvider) Token(context.Context) (*auth.Token, error) {
	iat := now()
	exp := iat.Add(time.Hour)
	scope := strings.Join(tp.scopes, " ")
	c := &jwt.Claims{
		Iss:   tp.email,
		Sub:   tp.email,
		Aud:   tp.audience,
		Scope: scope,
		Iat:   iat.Unix(),
		Exp:   exp.Unix(),
	}
	h := &jwt.Header{
		Algorithm: jwt.HeaderAlgRSA256,
		Type:      jwt.HeaderType,
		KeyID:     string(tp.pkID),
	}
	tok, err := jwt.EncodeJWS(h, c, tp.signer)
	if err != nil {
		return nil, fmt.Errorf("credentials: could not encode JWT: %w", err)
	}
	tp.logger.Debug("created self-signed JWT", "token", tok)
	return &auth.Token{Value: tok, Type: internal.TokenTypeBearer, Expiry: exp}, nil
}
