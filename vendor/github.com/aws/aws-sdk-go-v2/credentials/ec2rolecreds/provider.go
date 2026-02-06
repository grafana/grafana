package ec2rolecreds

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"path"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
	sdkrand "github.com/aws/aws-sdk-go-v2/internal/rand"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/logging"
	"github.com/aws/smithy-go/middleware"
)

// ProviderName provides a name of EC2Role provider
const ProviderName = "EC2RoleProvider"

// GetMetadataAPIClient provides the interface for an EC2 IMDS API client for the
// GetMetadata operation.
type GetMetadataAPIClient interface {
	GetMetadata(context.Context, *imds.GetMetadataInput, ...func(*imds.Options)) (*imds.GetMetadataOutput, error)
}

// A Provider retrieves credentials from the EC2 service, and keeps track if
// those credentials are expired.
//
// The New function must be used to create the with a custom EC2 IMDS client.
//
//	p := &ec2rolecreds.New(func(o *ec2rolecreds.Options{
//	     o.Client = imds.New(imds.Options{/* custom options */})
//	})
type Provider struct {
	options Options
}

// Options is a list of user settable options for setting the behavior of the Provider.
type Options struct {
	// The API client that will be used by the provider to make GetMetadata API
	// calls to EC2 IMDS.
	//
	// If nil, the provider will default to the EC2 IMDS client.
	Client GetMetadataAPIClient

	// The chain of providers that was used to create this provider
	// These values are for reporting purposes and are not meant to be set up directly
	CredentialSources []aws.CredentialSource
}

// New returns an initialized Provider value configured to retrieve
// credentials from EC2 Instance Metadata service.
func New(optFns ...func(*Options)) *Provider {
	options := Options{}

	for _, fn := range optFns {
		fn(&options)
	}

	if options.Client == nil {
		options.Client = imds.New(imds.Options{})
	}

	return &Provider{
		options: options,
	}
}

// Retrieve retrieves credentials from the EC2 service. Error will be returned
// if the request fails, or unable to extract the desired credentials.
func (p *Provider) Retrieve(ctx context.Context) (aws.Credentials, error) {
	credsList, err := requestCredList(ctx, p.options.Client)
	if err != nil {
		return aws.Credentials{Source: ProviderName}, err
	}

	if len(credsList) == 0 {
		return aws.Credentials{Source: ProviderName},
			fmt.Errorf("unexpected empty EC2 IMDS role list")
	}
	credsName := credsList[0]

	roleCreds, err := requestCred(ctx, p.options.Client, credsName)
	if err != nil {
		return aws.Credentials{Source: ProviderName}, err
	}

	creds := aws.Credentials{
		AccessKeyID:     roleCreds.AccessKeyID,
		SecretAccessKey: roleCreds.SecretAccessKey,
		SessionToken:    roleCreds.Token,
		Source:          ProviderName,

		CanExpire: true,
		Expires:   roleCreds.Expiration,
	}

	// Cap role credentials Expires to 1 hour so they can be refreshed more
	// often. Jitter will be applied credentials cache if being used.
	if anHour := sdk.NowTime().Add(1 * time.Hour); creds.Expires.After(anHour) {
		creds.Expires = anHour
	}

	return creds, nil
}

// HandleFailToRefresh will extend the credentials Expires time if it it is
// expired. If the credentials will not expire within the minimum time, they
// will be returned.
//
// If the credentials cannot expire, the original error will be returned.
func (p *Provider) HandleFailToRefresh(ctx context.Context, prevCreds aws.Credentials, err error) (
	aws.Credentials, error,
) {
	if !prevCreds.CanExpire {
		return aws.Credentials{}, err
	}

	if prevCreds.Expires.After(sdk.NowTime().Add(5 * time.Minute)) {
		return prevCreds, nil
	}

	newCreds := prevCreds
	randFloat64, err := sdkrand.CryptoRandFloat64()
	if err != nil {
		return aws.Credentials{}, fmt.Errorf("failed to get random float, %w", err)
	}

	// Random distribution of [5,15) minutes.
	expireOffset := time.Duration(randFloat64*float64(10*time.Minute)) + 5*time.Minute
	newCreds.Expires = sdk.NowTime().Add(expireOffset)

	logger := middleware.GetLogger(ctx)
	logger.Logf(logging.Warn, "Attempting credential expiration extension due to a credential service availability issue. A refresh of these credentials will be attempted again in %v minutes.", math.Floor(expireOffset.Minutes()))

	return newCreds, nil
}

// AdjustExpiresBy will adds the passed in duration to the passed in
// credential's Expires time, unless the time until Expires is less than 15
// minutes. Returns the credentials, even if not updated.
func (p *Provider) AdjustExpiresBy(creds aws.Credentials, dur time.Duration) (
	aws.Credentials, error,
) {
	if !creds.CanExpire {
		return creds, nil
	}
	if creds.Expires.Before(sdk.NowTime().Add(15 * time.Minute)) {
		return creds, nil
	}

	creds.Expires = creds.Expires.Add(dur)
	return creds, nil
}

// ec2RoleCredRespBody provides the shape for unmarshaling credential
// request responses.
type ec2RoleCredRespBody struct {
	// Success State
	Expiration      time.Time
	AccessKeyID     string
	SecretAccessKey string
	Token           string

	// Error state
	Code    string
	Message string
}

const iamSecurityCredsPath = "/iam/security-credentials/"

// requestCredList requests a list of credentials from the EC2 service. If
// there are no credentials, or there is an error making or receiving the
// request
func requestCredList(ctx context.Context, client GetMetadataAPIClient) ([]string, error) {
	resp, err := client.GetMetadata(ctx, &imds.GetMetadataInput{
		Path: iamSecurityCredsPath,
	})
	if err != nil {
		return nil, fmt.Errorf("no EC2 IMDS role found, %w", err)
	}
	defer resp.Content.Close()

	credsList := []string{}
	s := bufio.NewScanner(resp.Content)
	for s.Scan() {
		credsList = append(credsList, s.Text())
	}

	if err := s.Err(); err != nil {
		return nil, fmt.Errorf("failed to read EC2 IMDS role, %w", err)
	}

	return credsList, nil
}

// requestCred requests the credentials for a specific credentials from the EC2 service.
//
// If the credentials cannot be found, or there is an error reading the response
// and error will be returned.
func requestCred(ctx context.Context, client GetMetadataAPIClient, credsName string) (ec2RoleCredRespBody, error) {
	resp, err := client.GetMetadata(ctx, &imds.GetMetadataInput{
		Path: path.Join(iamSecurityCredsPath, credsName),
	})
	if err != nil {
		return ec2RoleCredRespBody{},
			fmt.Errorf("failed to get %s EC2 IMDS role credentials, %w",
				credsName, err)
	}
	defer resp.Content.Close()

	var respCreds ec2RoleCredRespBody
	if err := json.NewDecoder(resp.Content).Decode(&respCreds); err != nil {
		return ec2RoleCredRespBody{},
			fmt.Errorf("failed to decode %s EC2 IMDS role credentials, %w",
				credsName, err)
	}

	if !strings.EqualFold(respCreds.Code, "Success") {
		// If an error code was returned something failed requesting the role.
		return ec2RoleCredRespBody{},
			fmt.Errorf("failed to get %s EC2 IMDS role credentials, %w",
				credsName,
				&smithy.GenericAPIError{Code: respCreds.Code, Message: respCreds.Message})
	}

	return respCreds, nil
}

// ProviderSources returns the credential chain that was used to construct this provider
func (p *Provider) ProviderSources() []aws.CredentialSource {
	if p.options.CredentialSources == nil {
		return []aws.CredentialSource{aws.CredentialSourceIMDS}
	} // If no source has been set, assume this is used directly which means just call to assume role
	return p.options.CredentialSources
}
