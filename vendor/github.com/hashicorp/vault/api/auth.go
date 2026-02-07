// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"fmt"
)

// Auth is used to perform credential backend related operations.
type Auth struct {
	c *Client
}

type AuthMethod interface {
	Login(ctx context.Context, client *Client) (*Secret, error)
}

// Auth is used to return the client for credential-backend API calls.
func (c *Client) Auth() *Auth {
	return &Auth{c: c}
}

// Login sets up the required request body for login requests to the given auth
// method's /login API endpoint, and then performs a write to it. After a
// successful login, this method will automatically set the client's token to
// the login response's ClientToken as well.
//
// The Secret returned is the authentication secret, which if desired can be
// passed as input to the NewLifetimeWatcher method in order to start
// automatically renewing the token.
func (a *Auth) Login(ctx context.Context, authMethod AuthMethod) (*Secret, error) {
	if authMethod == nil {
		return nil, fmt.Errorf("no auth method provided for login")
	}
	return a.login(ctx, authMethod)
}

// MFALogin is a wrapper that helps satisfy Vault's MFA implementation.
// If optional credentials are provided a single-phase login will be attempted
// and the resulting Secret will contain a ClientToken if the authentication is successful.
// The client's token will also be set accordingly.
//
// If no credentials are provided a two-phase MFA login will be assumed and the resulting
// Secret will have a MFARequirement containing the MFARequestID to be used in a follow-up
// call to `sys/mfa/validate` or by passing it to the method (*Auth).MFAValidate.
func (a *Auth) MFALogin(ctx context.Context, authMethod AuthMethod, creds ...string) (*Secret, error) {
	if len(creds) > 0 {
		a.c.SetMFACreds(creds)
		return a.login(ctx, authMethod)
	}

	return a.twoPhaseMFALogin(ctx, authMethod)
}

// MFAValidate validates an MFA request using the appropriate payload and a secret containing
// Auth.MFARequirement, like the one returned by MFALogin when credentials are not provided.
// Upon successful validation the client token will be set accordingly.
//
// The Secret returned is the authentication secret, which if desired can be
// passed as input to the NewLifetimeWatcher method in order to start
// automatically renewing the token.
func (a *Auth) MFAValidate(ctx context.Context, mfaSecret *Secret, payload map[string]interface{}) (*Secret, error) {
	if mfaSecret == nil || mfaSecret.Auth == nil || mfaSecret.Auth.MFARequirement == nil {
		return nil, fmt.Errorf("secret does not contain MFARequirements")
	}

	s, err := a.c.Sys().MFAValidateWithContext(ctx, mfaSecret.Auth.MFARequirement.MFARequestID, payload)
	if err != nil {
		return nil, err
	}

	return a.checkAndSetToken(s)
}

// login performs the (*AuthMethod).Login() with the configured client and checks that a ClientToken is returned
func (a *Auth) login(ctx context.Context, authMethod AuthMethod) (*Secret, error) {
	s, err := authMethod.Login(ctx, a.c)
	if err != nil {
		return nil, fmt.Errorf("unable to log in to auth method: %w", err)
	}

	return a.checkAndSetToken(s)
}

// twoPhaseMFALogin performs the (*AuthMethod).Login() with the configured client
// and checks that an MFARequirement is returned
func (a *Auth) twoPhaseMFALogin(ctx context.Context, authMethod AuthMethod) (*Secret, error) {
	s, err := authMethod.Login(ctx, a.c)
	if err != nil {
		return nil, fmt.Errorf("unable to log in: %w", err)
	}
	if s == nil || s.Auth == nil || s.Auth.MFARequirement == nil {
		if s != nil {
			s.Warnings = append(s.Warnings, "expected secret to contain MFARequirements")
		}
		return s, fmt.Errorf("assumed two-phase MFA login, returned secret is missing MFARequirements")
	}

	return s, nil
}

func (a *Auth) checkAndSetToken(s *Secret) (*Secret, error) {
	if s == nil || s.Auth == nil || s.Auth.ClientToken == "" {
		if s != nil {
			s.Warnings = append(s.Warnings, "expected secret to contain ClientToken")
		}
		return s, fmt.Errorf("response did not return ClientToken, client token not set")
	}

	a.c.SetToken(s.Auth.ClientToken)

	return s, nil
}
