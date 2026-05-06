package azblob

import (
	"context"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

// Credential represent any credential type; it is used to create a credential policy Factory.
type Credential interface {
	pipeline.Factory
	credentialMarker()
}

type credentialFunc pipeline.FactoryFunc

func (f credentialFunc) New(next pipeline.Policy, po *pipeline.PolicyOptions) pipeline.Policy {
	return f(next, po)
}

// credentialMarker is a package-internal method that exists just to satisfy the Credential interface.
func (credentialFunc) credentialMarker() {}

//////////////////////////////

// NewAnonymousCredential creates an anonymous credential for use with HTTP(S) requests that read public resource
// or for use with Shared Access Signatures (SAS).
func NewAnonymousCredential() Credential {
	return anonymousCredentialFactory
}

var anonymousCredentialFactory Credential = &anonymousCredentialPolicyFactory{} // Singleton

// anonymousCredentialPolicyFactory is the credential's policy factory.
type anonymousCredentialPolicyFactory struct {
}

// New creates a credential policy object.
func (f *anonymousCredentialPolicyFactory) New(next pipeline.Policy, po *pipeline.PolicyOptions) pipeline.Policy {
	return &anonymousCredentialPolicy{next: next}
}

// credentialMarker is a package-internal method that exists just to satisfy the Credential interface.
func (*anonymousCredentialPolicyFactory) credentialMarker() {}

// anonymousCredentialPolicy is the credential's policy object.
type anonymousCredentialPolicy struct {
	next pipeline.Policy
}

// Do implements the credential's policy interface.
func (p anonymousCredentialPolicy) Do(ctx context.Context, request pipeline.Request) (pipeline.Response, error) {
	// For anonymous credentials, this is effectively a no-op
	return p.next.Do(ctx, request)
}
