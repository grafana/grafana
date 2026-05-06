package aws

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"github.com/aws/aws-sdk-go-v2/internal/sdk"
)

// AnonymousCredentials provides a sentinel CredentialsProvider that should be
// used to instruct the SDK's signing middleware to not sign the request.
//
// Using `nil` credentials when configuring an API client will achieve the same
// result. The AnonymousCredentials type allows you to configure the SDK's
// external config loading to not attempt to source credentials from the shared
// config or environment.
//
// For example you can use this CredentialsProvider with an API client's
// Options to instruct the client not to sign a request for accessing public
// S3 bucket objects.
//
// The following example demonstrates using the AnonymousCredentials to prevent
// SDK's external config loading attempt to resolve credentials.
//
//	cfg, err := config.LoadDefaultConfig(context.TODO(),
//	     config.WithCredentialsProvider(aws.AnonymousCredentials{}),
//	)
//	if err != nil {
//	     log.Fatalf("failed to load config, %v", err)
//	}
//
//	client := s3.NewFromConfig(cfg)
//
// Alternatively you can leave the API client Option's `Credential` member to
// nil. If using the `NewFromConfig` constructor you'll need to explicitly set
// the `Credentials` member to nil, if the external config resolved a
// credential provider.
//
//	client := s3.New(s3.Options{
//	     // Credentials defaults to a nil value.
//	})
//
// This can also be configured for specific operations calls too.
//
//	cfg, err := config.LoadDefaultConfig(context.TODO())
//	if err != nil {
//	     log.Fatalf("failed to load config, %v", err)
//	}
//
//	client := s3.NewFromConfig(config)
//
//	result, err := client.GetObject(context.TODO(), s3.GetObject{
//	     Bucket: aws.String("example-bucket"),
//	     Key: aws.String("example-key"),
//	}, func(o *s3.Options) {
//	     o.Credentials = nil
//	     // Or
//	     o.Credentials = aws.AnonymousCredentials{}
//	})
type AnonymousCredentials struct{}

// Retrieve implements the CredentialsProvider interface, but will always
// return error, and cannot be used to sign a request. The AnonymousCredentials
// type is used as a sentinel type instructing the AWS request signing
// middleware to not sign a request.
func (AnonymousCredentials) Retrieve(context.Context) (Credentials, error) {
	return Credentials{Source: "AnonymousCredentials"},
		fmt.Errorf("the AnonymousCredentials is not a valid credential provider, and cannot be used to sign AWS requests with")
}

// CredentialSource is the source of the credential provider.
// A provider can have multiple credential sources: For example, a provider that reads a profile, calls ECS to
// get credentials and then assumes a role using STS will have all these as part of its provider chain.
type CredentialSource int

const (
	// CredentialSourceUndefined is the sentinel zero value
	CredentialSourceUndefined CredentialSource = iota
	// CredentialSourceCode credentials resolved from code, cli parameters, session object, or client instance
	CredentialSourceCode
	// CredentialSourceEnvVars credentials resolved from environment variables
	CredentialSourceEnvVars
	// CredentialSourceEnvVarsSTSWebIDToken credentials resolved from environment variables for assuming a role with STS using a web identity token
	CredentialSourceEnvVarsSTSWebIDToken
	// CredentialSourceSTSAssumeRole credentials resolved from STS using AssumeRole
	CredentialSourceSTSAssumeRole
	// CredentialSourceSTSAssumeRoleSaml credentials resolved from STS using assume role with SAML
	CredentialSourceSTSAssumeRoleSaml
	// CredentialSourceSTSAssumeRoleWebID credentials resolved from STS using assume role with web identity
	CredentialSourceSTSAssumeRoleWebID
	// CredentialSourceSTSFederationToken credentials resolved from STS using a federation token
	CredentialSourceSTSFederationToken
	// CredentialSourceSTSSessionToken credentials resolved from STS using a session token 	S
	CredentialSourceSTSSessionToken
	// CredentialSourceProfile  credentials resolved from a config file(s) profile with static credentials
	CredentialSourceProfile
	// CredentialSourceProfileSourceProfile credentials resolved from a source profile in a config file(s) profile
	CredentialSourceProfileSourceProfile
	// CredentialSourceProfileNamedProvider credentials resolved from a named provider in a config file(s) profile (like EcsContainer)
	CredentialSourceProfileNamedProvider
	// CredentialSourceProfileSTSWebIDToken  credentials resolved from configuration for assuming a role with STS using web identity token in a config file(s) profile
	CredentialSourceProfileSTSWebIDToken
	// CredentialSourceProfileSSO credentials resolved from an SSO session in a config file(s) profile
	CredentialSourceProfileSSO
	// CredentialSourceSSO credentials resolved from an SSO session
	CredentialSourceSSO
	// CredentialSourceProfileSSOLegacy credentials resolved from an SSO session in a config file(s) profile using legacy format
	CredentialSourceProfileSSOLegacy
	// CredentialSourceSSOLegacy credentials resolved from an SSO session using legacy format
	CredentialSourceSSOLegacy
	// CredentialSourceProfileProcess credentials resolved from a process in a config file(s) profile
	CredentialSourceProfileProcess
	// CredentialSourceProcess credentials resolved from a process
	CredentialSourceProcess
	// CredentialSourceHTTP credentials resolved from an HTTP endpoint
	CredentialSourceHTTP
	// CredentialSourceIMDS credentials resolved from the instance metadata service (IMDS)
	CredentialSourceIMDS
)

// A Credentials is the AWS credentials value for individual credential fields.
type Credentials struct {
	// AWS Access key ID
	AccessKeyID string

	// AWS Secret Access Key
	SecretAccessKey string

	// AWS Session Token
	SessionToken string

	// Source of the credentials
	Source string

	// States if the credentials can expire or not.
	CanExpire bool

	// The time the credentials will expire at. Should be ignored if CanExpire
	// is false.
	Expires time.Time

	// The ID of the account for the credentials.
	AccountID string
}

// Expired returns if the credentials have expired.
func (v Credentials) Expired() bool {
	if v.CanExpire {
		// Calling Round(0) on the current time will truncate the monotonic
		// reading only. Ensures credential expiry time is always based on
		// reported wall-clock time.
		return !v.Expires.After(sdk.NowTime().Round(0))
	}

	return false
}

// HasKeys returns if the credentials keys are set.
func (v Credentials) HasKeys() bool {
	return len(v.AccessKeyID) > 0 && len(v.SecretAccessKey) > 0
}

// A CredentialsProvider is the interface for any component which will provide
// credentials Credentials. A CredentialsProvider is required to manage its own
// Expired state, and what to be expired means.
//
// A credentials provider implementation can be wrapped with a CredentialCache
// to cache the credential value retrieved. Without the cache the SDK will
// attempt to retrieve the credentials for every request.
type CredentialsProvider interface {
	// Retrieve returns nil if it successfully retrieved the value.
	// Error is returned if the value were not obtainable, or empty.
	Retrieve(ctx context.Context) (Credentials, error)
}

// CredentialProviderSource allows any credential provider to track
// all providers where a credential provider were sourced. For example, if the credentials came from a
// call to a role specified in the profile, this method will give the whole breadcrumb trail
type CredentialProviderSource interface {
	ProviderSources() []CredentialSource
}

// CredentialsProviderFunc provides a helper wrapping a function value to
// satisfy the CredentialsProvider interface.
type CredentialsProviderFunc func(context.Context) (Credentials, error)

// Retrieve delegates to the function value the CredentialsProviderFunc wraps.
func (fn CredentialsProviderFunc) Retrieve(ctx context.Context) (Credentials, error) {
	return fn(ctx)
}

type isCredentialsProvider interface {
	IsCredentialsProvider(CredentialsProvider) bool
}

// IsCredentialsProvider returns whether the target CredentialProvider is the same type as provider when comparing the
// implementation type.
//
// If provider has a method IsCredentialsProvider(CredentialsProvider) bool it will be responsible for validating
// whether target matches the credential provider type.
//
// When comparing the CredentialProvider implementations provider and target for equality, the following rules are used:
//
//	If provider is of type T and target is of type V, true if type *T is the same as type *V, otherwise false
//	If provider is of type *T and target is of type V, true if type *T is the same as type *V, otherwise false
//	If provider is of type T and target is of type *V, true if type *T is the same as type *V, otherwise false
//	If provider is of type *T and target is of type *V,true if type *T is the same as type *V, otherwise false
func IsCredentialsProvider(provider, target CredentialsProvider) bool {
	if target == nil || provider == nil {
		return provider == target
	}

	if x, ok := provider.(isCredentialsProvider); ok {
		return x.IsCredentialsProvider(target)
	}

	targetType := reflect.TypeOf(target)
	if targetType.Kind() != reflect.Ptr {
		targetType = reflect.PtrTo(targetType)
	}

	providerType := reflect.TypeOf(provider)
	if providerType.Kind() != reflect.Ptr {
		providerType = reflect.PtrTo(providerType)
	}

	return targetType.AssignableTo(providerType)
}
