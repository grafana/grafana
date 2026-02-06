// Package stscreds are credential Providers to retrieve STS AWS credentials.
//
// STS provides multiple ways to retrieve credentials which can be used when making
// future AWS service API operation calls.
//
// The SDK will ensure that per instance of credentials.Credentials all requests
// to refresh the credentials will be synchronized. But, the SDK is unable to
// ensure synchronous usage of the AssumeRoleProvider if the value is shared
// between multiple Credentials or service clients.
//
// # Assume Role
//
// To assume an IAM role using STS with the SDK you can create a new Credentials
// with the SDKs's stscreds package.
//
//	// Initial credentials loaded from SDK's default credential chain. Such as
//	// the environment, shared credentials (~/.aws/credentials), or EC2 Instance
//	// Role. These credentials will be used to to make the STS Assume Role API.
//	cfg, err := config.LoadDefaultConfig(context.TODO())
//	if err != nil {
//		panic(err)
//	}
//
//	// Create the credentials from AssumeRoleProvider to assume the role
//	// referenced by the "myRoleARN" ARN.
//	stsSvc := sts.NewFromConfig(cfg)
//	creds := stscreds.NewAssumeRoleProvider(stsSvc, "myRoleArn")
//
//	cfg.Credentials = aws.NewCredentialsCache(creds)
//
//	// Create service client value configured for credentials
//	// from assumed role.
//	svc := s3.NewFromConfig(cfg)
//
// # Assume Role with custom MFA Token provider
//
// To assume an IAM role with a MFA token you can either specify a custom MFA
// token provider or use the SDK's built in StdinTokenProvider that will prompt
// the user for a token code each time the credentials need to to be refreshed.
// Specifying a custom token provider allows you to control where the token
// code is retrieved from, and how it is refreshed.
//
// With a custom token provider, the provider is responsible for refreshing the
// token code when called.
//
//		cfg, err := config.LoadDefaultConfig(context.TODO())
//		if err != nil {
//			panic(err)
//		}
//
//	 staticTokenProvider := func() (string, error) {
//	     return someTokenCode, nil
//	 }
//
//		// Create the credentials from AssumeRoleProvider to assume the role
//		// referenced by the "myRoleARN" ARN using the MFA token code provided.
//		creds := stscreds.NewAssumeRoleProvider(sts.NewFromConfig(cfg), "myRoleArn", func(o *stscreds.AssumeRoleOptions) {
//			o.SerialNumber = aws.String("myTokenSerialNumber")
//			o.TokenProvider = staticTokenProvider
//		})
//
//		cfg.Credentials = aws.NewCredentialsCache(creds)
//
//		// Create service client value configured for credentials
//		// from assumed role.
//		svc := s3.NewFromConfig(cfg)
//
// # Assume Role with MFA Token Provider
//
// To assume an IAM role with MFA for longer running tasks where the credentials
// may need to be refreshed setting the TokenProvider field of AssumeRoleProvider
// will allow the credential provider to prompt for new MFA token code when the
// role's credentials need to be refreshed.
//
// The StdinTokenProvider function is available to prompt on stdin to retrieve
// the MFA token code from the user. You can also implement custom prompts by
// satisfying the TokenProvider function signature.
//
// Using StdinTokenProvider with multiple AssumeRoleProviders, or Credentials will
// have undesirable results as the StdinTokenProvider will not be synchronized. A
// single Credentials with an AssumeRoleProvider can be shared safely.
//
//	cfg, err := config.LoadDefaultConfig(context.TODO())
//	if err != nil {
//		panic(err)
//	}
//
//	// Create the credentials from AssumeRoleProvider to assume the role
//	// referenced by the "myRoleARN" ARN using the MFA token code provided.
//	creds := stscreds.NewAssumeRoleProvider(sts.NewFromConfig(cfg), "myRoleArn", func(o *stscreds.AssumeRoleOptions) {
//		o.SerialNumber = aws.String("myTokenSerialNumber")
//		o.TokenProvider = stscreds.StdinTokenProvider
//	})
//
//	cfg.Credentials = aws.NewCredentialsCache(creds)
//
//	// Create service client value configured for credentials
//	// from assumed role.
//	svc := s3.NewFromConfig(cfg)
package stscreds

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/aws-sdk-go-v2/service/sts/types"
)

// StdinTokenProvider will prompt on stdout and read from stdin for a string value.
// An error is returned if reading from stdin fails.
//
// Use this function go read MFA tokens from stdin. The function makes no attempt
// to make atomic prompts from stdin across multiple gorouties.
//
// Using StdinTokenProvider with multiple AssumeRoleProviders, or Credentials will
// have undesirable results as the StdinTokenProvider will not be synchronized. A
// single Credentials with an AssumeRoleProvider can be shared safely
//
// Will wait forever until something is provided on the stdin.
func StdinTokenProvider() (string, error) {
	var v string
	fmt.Printf("Assume Role MFA token code: ")
	_, err := fmt.Scanln(&v)

	return v, err
}

// ProviderName provides a name of AssumeRole provider
const ProviderName = "AssumeRoleProvider"

// AssumeRoleAPIClient is a client capable of the STS AssumeRole operation.
type AssumeRoleAPIClient interface {
	AssumeRole(ctx context.Context, params *sts.AssumeRoleInput, optFns ...func(*sts.Options)) (*sts.AssumeRoleOutput, error)
}

// DefaultDuration is the default amount of time in minutes that the
// credentials will be valid for. This value is only used by AssumeRoleProvider
// for specifying the default expiry duration of an assume role.
//
// Other providers such as WebIdentityRoleProvider do not use this value, and
// instead rely on STS API's default parameter handing to assign a default
// value.
var DefaultDuration = time.Duration(15) * time.Minute

// AssumeRoleProvider retrieves temporary credentials from the STS service, and
// keeps track of their expiration time.
//
// This credential provider will be used by the SDKs default credential change
// when shared configuration is enabled, and the shared config or shared credentials
// file configure assume role. See Session docs for how to do this.
//
// AssumeRoleProvider does not provide any synchronization and it is not safe
// to share this value across multiple Credentials, Sessions, or service clients
// without also sharing the same Credentials instance.
type AssumeRoleProvider struct {
	options AssumeRoleOptions
}

// AssumeRoleOptions is the configurable options for AssumeRoleProvider
type AssumeRoleOptions struct {
	// Client implementation of the AssumeRole operation. Required
	Client AssumeRoleAPIClient

	// IAM Role ARN to be assumed. Required
	RoleARN string

	// Session name, if you wish to uniquely identify this session.
	RoleSessionName string

	// Expiry duration of the STS credentials. Defaults to 15 minutes if not set.
	Duration time.Duration

	// Optional ExternalID to pass along, defaults to nil if not set.
	ExternalID *string

	// The policy plain text must be 2048 bytes or shorter. However, an internal
	// conversion compresses it into a packed binary format with a separate limit.
	// The PackedPolicySize response element indicates by percentage how close to
	// the upper size limit the policy is, with 100% equaling the maximum allowed
	// size.
	Policy *string

	// The ARNs of IAM managed policies you want to use as managed session policies.
	// The policies must exist in the same account as the role.
	//
	// This parameter is optional. You can provide up to 10 managed policy ARNs.
	// However, the plain text that you use for both inline and managed session
	// policies can't exceed 2,048 characters.
	//
	// An AWS conversion compresses the passed session policies and session tags
	// into a packed binary format that has a separate limit. Your request can fail
	// for this limit even if your plain text meets the other requirements. The
	// PackedPolicySize response element indicates by percentage how close the policies
	// and tags for your request are to the upper size limit.
	//
	// Passing policies to this operation returns new temporary credentials. The
	// resulting session's permissions are the intersection of the role's identity-based
	// policy and the session policies. You can use the role's temporary credentials
	// in subsequent AWS API calls to access resources in the account that owns
	// the role. You cannot use session policies to grant more permissions than
	// those allowed by the identity-based policy of the role that is being assumed.
	// For more information, see Session Policies (https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html#policies_session)
	// in the IAM User Guide.
	PolicyARNs []types.PolicyDescriptorType

	// The identification number of the MFA device that is associated with the user
	// who is making the AssumeRole call. Specify this value if the trust policy
	// of the role being assumed includes a condition that requires MFA authentication.
	// The value is either the serial number for a hardware device (such as GAHT12345678)
	// or an Amazon Resource Name (ARN) for a virtual device (such as arn:aws:iam::123456789012:mfa/user).
	SerialNumber *string

	// The source identity specified by the principal that is calling the AssumeRole
	// operation. You can require users to specify a source identity when they assume a
	// role. You do this by using the sts:SourceIdentity condition key in a role trust
	// policy. You can use source identity information in CloudTrail logs to determine
	// who took actions with a role. You can use the aws:SourceIdentity condition key
	// to further control access to Amazon Web Services resources based on the value of
	// source identity. For more information about using source identity, see Monitor
	// and control actions taken with assumed roles
	// (https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html)
	// in the IAM User Guide.
	SourceIdentity *string

	// Async method of providing MFA token code for assuming an IAM role with MFA.
	// The value returned by the function will be used as the TokenCode in the Retrieve
	// call. See StdinTokenProvider for a provider that prompts and reads from stdin.
	//
	// This token provider will be called when ever the assumed role's
	// credentials need to be refreshed when SerialNumber is set.
	TokenProvider func() (string, error)

	// A list of session tags that you want to pass. Each session tag consists of a key
	// name and an associated value. For more information about session tags, see
	// Tagging STS Sessions
	// (https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html) in the
	// IAM User Guide. This parameter is optional. You can pass up to 50 session tags.
	Tags []types.Tag

	// A list of keys for session tags that you want to set as transitive. If you set a
	// tag key as transitive, the corresponding key and value passes to subsequent
	// sessions in a role chain. For more information, see Chaining Roles with Session
	// Tags
	// (https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html#id_session-tags_role-chaining)
	// in the IAM User Guide. This parameter is optional.
	TransitiveTagKeys []string

	// The chain of providers that was used to create this provider
	// These values are for reporting purposes and are not meant to be set up directly
	CredentialSources []aws.CredentialSource
}

// NewAssumeRoleProvider constructs and returns a credentials provider that
// will retrieve credentials by assuming a IAM role using STS.
func NewAssumeRoleProvider(client AssumeRoleAPIClient, roleARN string, optFns ...func(*AssumeRoleOptions)) *AssumeRoleProvider {
	o := AssumeRoleOptions{
		Client:  client,
		RoleARN: roleARN,
	}

	for _, fn := range optFns {
		fn(&o)
	}

	return &AssumeRoleProvider{
		options: o,
	}
}

// Retrieve generates a new set of temporary credentials using STS.
func (p *AssumeRoleProvider) Retrieve(ctx context.Context) (aws.Credentials, error) {
	// Apply defaults where parameters are not set.
	if len(p.options.RoleSessionName) == 0 {
		// Try to work out a role name that will hopefully end up unique.
		p.options.RoleSessionName = fmt.Sprintf("aws-go-sdk-%d", time.Now().UTC().UnixNano())
	}
	if p.options.Duration == 0 {
		// Expire as often as AWS permits.
		p.options.Duration = DefaultDuration
	}
	input := &sts.AssumeRoleInput{
		DurationSeconds:   aws.Int32(int32(p.options.Duration / time.Second)),
		PolicyArns:        p.options.PolicyARNs,
		RoleArn:           aws.String(p.options.RoleARN),
		RoleSessionName:   aws.String(p.options.RoleSessionName),
		ExternalId:        p.options.ExternalID,
		SourceIdentity:    p.options.SourceIdentity,
		Tags:              p.options.Tags,
		TransitiveTagKeys: p.options.TransitiveTagKeys,
	}
	if p.options.Policy != nil {
		input.Policy = p.options.Policy
	}
	if p.options.SerialNumber != nil {
		if p.options.TokenProvider != nil {
			input.SerialNumber = p.options.SerialNumber
			code, err := p.options.TokenProvider()
			if err != nil {
				return aws.Credentials{}, err
			}
			input.TokenCode = aws.String(code)
		} else {
			return aws.Credentials{}, fmt.Errorf("assume role with MFA enabled, but TokenProvider is not set")
		}
	}

	resp, err := p.options.Client.AssumeRole(ctx, input)
	if err != nil {
		return aws.Credentials{Source: ProviderName}, err
	}

	var accountID string
	if resp.AssumedRoleUser != nil {
		accountID = getAccountID(resp.AssumedRoleUser)
	}

	return aws.Credentials{
		AccessKeyID:     *resp.Credentials.AccessKeyId,
		SecretAccessKey: *resp.Credentials.SecretAccessKey,
		SessionToken:    *resp.Credentials.SessionToken,
		Source:          ProviderName,

		CanExpire: true,
		Expires:   *resp.Credentials.Expiration,
		AccountID: accountID,
	}, nil
}

// ProviderSources returns the credential chain that was used to construct this provider
func (p *AssumeRoleProvider) ProviderSources() []aws.CredentialSource {
	if p.options.CredentialSources == nil {
		return []aws.CredentialSource{aws.CredentialSourceSTSAssumeRole}
	} // If no source has been set, assume this is used directly which means just call to assume role
	return append(p.options.CredentialSources, aws.CredentialSourceSTSAssumeRole)
}
