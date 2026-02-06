package stscreds

import (
	"context"
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/aws-sdk-go-v2/service/sts/types"
)

var invalidIdentityTokenExceptionCode = (&types.InvalidIdentityTokenException{}).ErrorCode()

const (
	// WebIdentityProviderName is the web identity provider name
	WebIdentityProviderName = "WebIdentityCredentials"
)

// AssumeRoleWithWebIdentityAPIClient is a client capable of the STS AssumeRoleWithWebIdentity operation.
type AssumeRoleWithWebIdentityAPIClient interface {
	AssumeRoleWithWebIdentity(ctx context.Context, params *sts.AssumeRoleWithWebIdentityInput, optFns ...func(*sts.Options)) (*sts.AssumeRoleWithWebIdentityOutput, error)
}

// WebIdentityRoleProvider is used to retrieve credentials using
// an OIDC token.
type WebIdentityRoleProvider struct {
	options WebIdentityRoleOptions
}

// WebIdentityRoleOptions is a structure of configurable options for WebIdentityRoleProvider
type WebIdentityRoleOptions struct {
	// Client implementation of the AssumeRoleWithWebIdentity operation. Required
	Client AssumeRoleWithWebIdentityAPIClient

	// JWT Token Provider. Required
	TokenRetriever IdentityTokenRetriever

	// IAM Role ARN to assume. Required
	RoleARN string

	// Session name, if you wish to uniquely identify this session.
	RoleSessionName string

	// Expiry duration of the STS credentials. STS will assign a default expiry
	// duration if this value is unset. This is different from the Duration
	// option of AssumeRoleProvider, which automatically assigns 15 minutes if
	// Duration is unset.
	//
	// See the STS AssumeRoleWithWebIdentity API reference guide for more
	// information on defaults.
	// https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html
	Duration time.Duration

	// An IAM policy in JSON format that you want to use as an inline session policy.
	Policy *string

	// The Amazon Resource Names (ARNs) of the IAM managed policies that you
	// want to use as managed session policies.  The policies must exist in the
	// same account as the role.
	PolicyARNs []types.PolicyDescriptorType

	// The chain of providers that was used to create this provider
	// These values are for reporting purposes and are not meant to be set up directly
	CredentialSources []aws.CredentialSource
}

// IdentityTokenRetriever is an interface for retrieving a JWT
type IdentityTokenRetriever interface {
	GetIdentityToken() ([]byte, error)
}

// IdentityTokenFile is for retrieving an identity token from the given file name
type IdentityTokenFile string

// GetIdentityToken retrieves the JWT token from the file and returns the contents as a []byte
func (j IdentityTokenFile) GetIdentityToken() ([]byte, error) {
	b, err := ioutil.ReadFile(string(j))
	if err != nil {
		return nil, fmt.Errorf("unable to read file at %s: %v", string(j), err)
	}

	return b, nil
}

// NewWebIdentityRoleProvider will return a new WebIdentityRoleProvider with the
// provided stsiface.ClientAPI
func NewWebIdentityRoleProvider(client AssumeRoleWithWebIdentityAPIClient, roleARN string, tokenRetriever IdentityTokenRetriever, optFns ...func(*WebIdentityRoleOptions)) *WebIdentityRoleProvider {
	o := WebIdentityRoleOptions{
		Client:         client,
		RoleARN:        roleARN,
		TokenRetriever: tokenRetriever,
	}

	for _, fn := range optFns {
		fn(&o)
	}

	return &WebIdentityRoleProvider{options: o}
}

// Retrieve will attempt to assume a role from a token which is located at
// 'WebIdentityTokenFilePath' specified destination and if that is empty an
// error will be returned.
func (p *WebIdentityRoleProvider) Retrieve(ctx context.Context) (aws.Credentials, error) {
	b, err := p.options.TokenRetriever.GetIdentityToken()
	if err != nil {
		return aws.Credentials{}, fmt.Errorf("failed to retrieve jwt from provide source, %w", err)
	}

	sessionName := p.options.RoleSessionName
	if len(sessionName) == 0 {
		// session name is used to uniquely identify a session. This simply
		// uses unix time in nanoseconds to uniquely identify sessions.
		sessionName = strconv.FormatInt(sdk.NowTime().UnixNano(), 10)
	}
	input := &sts.AssumeRoleWithWebIdentityInput{
		PolicyArns:       p.options.PolicyARNs,
		RoleArn:          &p.options.RoleARN,
		RoleSessionName:  &sessionName,
		WebIdentityToken: aws.String(string(b)),
	}
	if p.options.Duration != 0 {
		// If set use the value, otherwise STS will assign a default expiration duration.
		input.DurationSeconds = aws.Int32(int32(p.options.Duration / time.Second))
	}
	if p.options.Policy != nil {
		input.Policy = p.options.Policy
	}

	resp, err := p.options.Client.AssumeRoleWithWebIdentity(ctx, input, func(options *sts.Options) {
		options.Retryer = retry.AddWithErrorCodes(options.Retryer, invalidIdentityTokenExceptionCode)
	})
	if err != nil {
		return aws.Credentials{}, fmt.Errorf("failed to retrieve credentials, %w", err)
	}

	var accountID string
	if resp.AssumedRoleUser != nil {
		accountID = getAccountID(resp.AssumedRoleUser)
	}

	// InvalidIdentityToken error is a temporary error that can occur
	// when assuming an Role with a JWT web identity token.

	value := aws.Credentials{
		AccessKeyID:     aws.ToString(resp.Credentials.AccessKeyId),
		SecretAccessKey: aws.ToString(resp.Credentials.SecretAccessKey),
		SessionToken:    aws.ToString(resp.Credentials.SessionToken),
		Source:          WebIdentityProviderName,
		CanExpire:       true,
		Expires:         *resp.Credentials.Expiration,
		AccountID:       accountID,
	}
	return value, nil
}

// extract accountID from arn with format "arn:partition:service:region:account-id:[resource-section]"
func getAccountID(u *types.AssumedRoleUser) string {
	if u.Arn == nil {
		return ""
	}
	parts := strings.Split(*u.Arn, ":")
	if len(parts) < 5 {
		return ""
	}
	return parts[4]
}

// ProviderSources returns the credential chain that was used to construct this provider
func (p *WebIdentityRoleProvider) ProviderSources() []aws.CredentialSource {
	if p.options.CredentialSources == nil {
		return []aws.CredentialSource{aws.CredentialSourceSTSAssumeRoleWebID}
	}
	return p.options.CredentialSources
}
