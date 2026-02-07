//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/public"
)

var supportedAuthRecordVersions = []string{"1.0"}

// AuthenticationRecord is non-secret account information about an authenticated user that user credentials such as
// [DeviceCodeCredential] and [InteractiveBrowserCredential] can use to access previously cached authentication
// data. Call these credentials' Authenticate method to get an AuthenticationRecord for a user.
type AuthenticationRecord struct {
	// Authority is the URL of the authority that issued the token.
	Authority string `json:"authority"`

	// ClientID is the ID of the application that authenticated the user.
	ClientID string `json:"clientId"`

	// HomeAccountID uniquely identifies the account.
	HomeAccountID string `json:"homeAccountId"`

	// TenantID identifies the tenant in which the user authenticated.
	TenantID string `json:"tenantId"`

	// Username is the user's preferred username.
	Username string `json:"username"`

	// Version of the AuthenticationRecord.
	Version string `json:"version"`
}

// UnmarshalJSON implements json.Unmarshaler for AuthenticationRecord
func (a *AuthenticationRecord) UnmarshalJSON(b []byte) error {
	// Default unmarshaling is fine but we want to return an error if the record's version isn't supported i.e., we
	// want to inspect the unmarshalled values before deciding whether to return an error. Unmarshaling a formally
	// different type enables this by assigning all the fields without recursing into this method.
	type r AuthenticationRecord
	err := json.Unmarshal(b, (*r)(a))
	if err != nil {
		return err
	}
	if a.Version == "" {
		return errors.New("AuthenticationRecord must have a version")
	}
	for _, v := range supportedAuthRecordVersions {
		if a.Version == v {
			return nil
		}
	}
	return fmt.Errorf("unsupported AuthenticationRecord version %q. This module supports %v", a.Version, supportedAuthRecordVersions)
}

// account returns the AuthenticationRecord as an MSAL Account. The account is zero-valued when the AuthenticationRecord is zero-valued.
func (a *AuthenticationRecord) account() public.Account {
	return public.Account{
		Environment:       a.Authority,
		HomeAccountID:     a.HomeAccountID,
		PreferredUsername: a.Username,
	}
}

func newAuthenticationRecord(ar public.AuthResult) (AuthenticationRecord, error) {
	u, err := url.Parse(ar.IDToken.Issuer)
	if err != nil {
		return AuthenticationRecord{}, fmt.Errorf("Authenticate expected a URL issuer but got %q", ar.IDToken.Issuer)
	}
	tenant := ar.IDToken.TenantID
	if tenant == "" {
		tenant = strings.Trim(u.Path, "/")
	}
	username := ar.IDToken.PreferredUsername
	if username == "" {
		username = ar.IDToken.UPN
	}
	return AuthenticationRecord{
		Authority:     fmt.Sprintf("%s://%s", u.Scheme, u.Host),
		ClientID:      ar.IDToken.Audience,
		HomeAccountID: ar.Account.HomeAccountID,
		TenantID:      tenant,
		Username:      username,
		Version:       "1.0",
	}, nil
}
