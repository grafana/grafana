//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"fmt"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
)

const credNameManagedIdentity = "ManagedIdentityCredential"

type managedIdentityIDKind int

const (
	miClientID managedIdentityIDKind = iota
	miObjectID
	miResourceID
)

// ManagedIDKind identifies the ID of a managed identity as either a client or resource ID
type ManagedIDKind interface {
	fmt.Stringer
	idKind() managedIdentityIDKind
}

// ClientID is the client ID of a user-assigned managed identity. [NewManagedIdentityCredential]
// returns an error when a ClientID is specified on the following platforms:
//
//   - Azure Arc
//   - Cloud Shell
//   - Service Fabric
type ClientID string

func (ClientID) idKind() managedIdentityIDKind {
	return miClientID
}

// String returns the string value of the ID.
func (c ClientID) String() string {
	return string(c)
}

// ObjectID is the object ID of a user-assigned managed identity. [NewManagedIdentityCredential]
// returns an error when an ObjectID is specified on the following platforms:
//
//   - Azure Arc
//   - Azure ML
//   - Cloud Shell
//   - Service Fabric
type ObjectID string

func (ObjectID) idKind() managedIdentityIDKind {
	return miObjectID
}

// String returns the string value of the ID.
func (o ObjectID) String() string {
	return string(o)
}

// ResourceID is the resource ID of a user-assigned managed identity. [NewManagedIdentityCredential]
// returns an error when a ResourceID is specified on the following platforms:
//
//   - Azure Arc
//   - Azure ML
//   - Cloud Shell
//   - Service Fabric
type ResourceID string

func (ResourceID) idKind() managedIdentityIDKind {
	return miResourceID
}

// String returns the string value of the ID.
func (r ResourceID) String() string {
	return string(r)
}

// ManagedIdentityCredentialOptions contains optional parameters for ManagedIdentityCredential.
type ManagedIdentityCredentialOptions struct {
	azcore.ClientOptions

	// ID of a managed identity the credential should authenticate. Set this field to use a specific identity instead of
	// the hosting environment's default. The value may be the identity's client, object, or resource ID.
	// NewManagedIdentityCredential returns an error when the hosting environment doesn't support user-assigned managed
	// identities, or the specified kind of ID.
	ID ManagedIDKind

	// dac indicates whether the credential is part of DefaultAzureCredential. When true, and the environment doesn't have
	// configuration for a specific managed identity API, the credential tries to determine whether IMDS is available before
	// sending its first token request. It does this by sending a malformed request with a short timeout. Any response to that
	// request is taken to mean IMDS is available, in which case the credential will send ordinary token requests thereafter
	// with no special timeout. The purpose of this behavior is to prevent a very long timeout when IMDS isn't available.
	dac bool
}

// ManagedIdentityCredential authenticates an [Azure managed identity] in any hosting environment supporting managed identities.
// This credential authenticates a system-assigned identity by default. Use ManagedIdentityCredentialOptions.ID to specify a
// user-assigned identity.
//
// [Azure managed identity]: https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview
type ManagedIdentityCredential struct {
	mic *managedIdentityClient
}

// NewManagedIdentityCredential creates a ManagedIdentityCredential. Pass nil to accept default options.
func NewManagedIdentityCredential(options *ManagedIdentityCredentialOptions) (*ManagedIdentityCredential, error) {
	if options == nil {
		options = &ManagedIdentityCredentialOptions{}
	}
	mic, err := newManagedIdentityClient(options)
	if err != nil {
		return nil, err
	}
	return &ManagedIdentityCredential{mic: mic}, nil
}

// GetToken requests an access token from the hosting environment. This method is called automatically by Azure SDK clients.
func (c *ManagedIdentityCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameManagedIdentity+"."+traceOpGetToken, c.mic.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()

	if len(opts.Scopes) != 1 {
		err = fmt.Errorf("%s.GetToken() requires exactly one scope", credNameManagedIdentity)
		return azcore.AccessToken{}, err
	}
	// managed identity endpoints require a v1 resource (i.e. token audience), not a v2 scope, so we remove "/.default" here
	opts.Scopes = []string{strings.TrimSuffix(opts.Scopes[0], defaultSuffix)}
	return c.mic.GetToken(ctx, opts)
}

var _ azcore.TokenCredential = (*ManagedIdentityCredential)(nil)
