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
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/compute/metadata"
)

var (
	computeTokenMetadata = map[string]interface{}{
		"auth.google.tokenSource":    "compute-metadata",
		"auth.google.serviceAccount": "default",
	}
	computeTokenURI = "instance/service-accounts/default/token"
)

// computeTokenProvider creates a [cloud.google.com/go/auth.TokenProvider] that
// uses the metadata service to retrieve tokens.
func computeTokenProvider(opts *DetectOptions, client *metadata.Client) auth.TokenProvider {
	return auth.NewCachedTokenProvider(&computeProvider{
		scopes:           opts.Scopes,
		client:           client,
		tokenBindingType: opts.TokenBindingType,
	}, &auth.CachedTokenProviderOptions{
		ExpireEarly:         opts.EarlyTokenRefresh,
		DisableAsyncRefresh: opts.DisableAsyncRefresh,
	})
}

// computeProvider fetches tokens from the google cloud metadata service.
type computeProvider struct {
	scopes           []string
	client           *metadata.Client
	tokenBindingType TokenBindingType
}

type metadataTokenResp struct {
	AccessToken  string `json:"access_token"`
	ExpiresInSec int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

func (cs *computeProvider) Token(ctx context.Context) (*auth.Token, error) {
	tokenURI, err := url.Parse(computeTokenURI)
	if err != nil {
		return nil, err
	}
	hasScopes := len(cs.scopes) > 0
	if hasScopes || cs.tokenBindingType != NoBinding {
		v := url.Values{}
		if hasScopes {
			v.Set("scopes", strings.Join(cs.scopes, ","))
		}
		switch cs.tokenBindingType {
		case MTLSHardBinding:
			v.Set("transport", "mtls")
			v.Set("binding-enforcement", "on")
		case ALTSHardBinding:
			v.Set("transport", "alts")
		}
		tokenURI.RawQuery = v.Encode()
	}
	tokenJSON, err := cs.client.GetWithContext(ctx, tokenURI.String())
	if err != nil {
		return nil, fmt.Errorf("credentials: cannot fetch token: %w", err)
	}
	var res metadataTokenResp
	if err := json.NewDecoder(strings.NewReader(tokenJSON)).Decode(&res); err != nil {
		return nil, fmt.Errorf("credentials: invalid token JSON from metadata: %w", err)
	}
	if res.ExpiresInSec == 0 || res.AccessToken == "" {
		return nil, errors.New("credentials: incomplete token received from metadata")
	}
	return &auth.Token{
		Value:    res.AccessToken,
		Type:     res.TokenType,
		Expiry:   time.Now().Add(time.Duration(res.ExpiresInSec) * time.Second),
		Metadata: computeTokenMetadata,
	}, nil

}
