package awsauth

import (
	"context"
	"fmt"
	"hash/fnv"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws/middleware"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	smithymiddleware "github.com/aws/smithy-go/middleware"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-aws-sdk/pkg/common"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana-plugin-sdk-go/build"
)

const (
	// awsTempCredsAccessKey and awsTempCredsSecretKey are the files containing the
	awsTempCredsAccessKey = "/tmp/aws.credentials/access-key-id"
	awsTempCredsSecretKey = "/tmp/aws.credentials/secret-access-key"
	profileName           = "assume_role_credentials"
)

// Settings carries configuration for authenticating with AWS
type Settings struct {
	AuthType AuthType
	// deprecated: use AuthType instead
	LegacyAuthType     awsds.AuthType
	AccessKey          string
	SecretKey          string
	Region             string
	CredentialsPath    string
	CredentialsProfile string
	AssumeRoleARN      string
	Endpoint           string
	ExternalID         string
	UserAgent          string
	SessionToken       string
	HTTPClient         *http.Client
	ProxyOptions       *proxy.Options
}

// Hash returns a value suitable for caching the config associated with these settings
func (s Settings) Hash() uint64 {
	h := fnv.New64()
	// In theory all of these except for region will be moot, because if any of them
	// change the datasource instance will be recycled. However, to ensure no leakage
	// of credentials between instances, we check everything except proxy options.
	// If those change the datasource will definitely not be reused.
	_, _ = h.Write([]byte(s.GetAuthType()))
	_, _ = h.Write([]byte(s.AccessKey))
	_, _ = h.Write([]byte(s.SecretKey))
	_, _ = h.Write([]byte(s.Region))
	_, _ = h.Write([]byte(s.CredentialsPath))
	_, _ = h.Write([]byte(s.CredentialsProfile))
	_, _ = h.Write([]byte(s.AssumeRoleARN))
	_, _ = h.Write([]byte(s.Endpoint))
	_, _ = h.Write([]byte(s.ExternalID))
	return h.Sum64()
}

func (s Settings) GetAuthType() AuthType {
	if s.AuthType != AuthTypeMissing {
		return s.AuthType
	}
	return fromLegacy(s.LegacyAuthType)
}

func (s Settings) BaseOptions() []LoadOptionsFunc {
	return []LoadOptionsFunc{s.WithRegion(), s.WithEndpoint(), s.WithHTTPClient(), s.WithUserAgent()}
}

func (s Settings) WithRegion() LoadOptionsFunc {
	return func(opts *config.LoadOptions) error {
		if s.Region != "" && s.Region != "default" {
			opts.Region = s.Region
		}
		return nil
	}
}

func (s Settings) WithEndpoint() LoadOptionsFunc {
	useFips := false
	if strings.Contains(s.Endpoint, "-fips.") || strings.Contains(s.Region, "us-gov") {
		// TODO: add fips support as an toggle option
		s.Endpoint = ""
		useFips = true
	}
	return func(options *config.LoadOptions) error {
		if s.Endpoint != "" && s.Endpoint != "default" && !isStsEndpoint(&s.Endpoint) {
			options.BaseEndpoint = s.Endpoint
		}
		if useFips {
			options.UseFIPSEndpoint = aws.FIPSEndpointStateEnabled
		}
		return nil
	}
}

func (s Settings) WithStaticCredentials(client AWSAPIClient) LoadOptionsFunc {
	return func(opts *config.LoadOptions) error {
		opts.Credentials = client.NewStaticCredentialsProvider(s.AccessKey, s.SecretKey, s.SessionToken)
		return nil
	}
}

// WithSharedCredentials returns a LoadOptionsFunc to initialize config from a credentials file
func (s Settings) WithSharedCredentials() LoadOptionsFunc {
	return func(options *config.LoadOptions) error {
		options.SharedConfigProfile = s.CredentialsProfile
		if s.CredentialsPath != "" {
			options.SharedCredentialsFiles = []string{s.CredentialsPath}
		}
		return nil
	}
}

// WithGrafanaAssumeRole returns a LoadOptionsFunc to initialize config for Grafana Assume Role
func (s Settings) WithGrafanaAssumeRole(ctx context.Context, client AWSAPIClient) LoadOptionsFunc {
	accessKey, keyErr := os.ReadFile(awsTempCredsAccessKey)
	secretKey, secretErr := os.ReadFile(awsTempCredsSecretKey)
	if keyErr == nil && secretErr == nil {
		return func(opts *config.LoadOptions) error {
			opts.Credentials = client.NewStaticCredentialsProvider(string(accessKey), string(secretKey), "")
			return nil
		}
	}

	// if we don't find the files assume it's running single tenant and use the credentials file
	return func(options *config.LoadOptions) error {
		options.SharedConfigProfile = profileName
		if s.CredentialsPath != "" {
			options.SharedCredentialsFiles = []string{s.CredentialsPath}
		}
		return nil
	}
}

func (s Settings) WithAssumeRole(cfg aws.Config, client AWSAPIClient, sessionDuration *time.Duration) LoadOptionsFunc {
	if common.IsOptInRegion(cfg.Region) {
		cfg.Region = "us-east-1"
	}
	stsClient := client.NewSTSClientFromConfig(cfg)
	provider := client.NewAssumeRoleProvider(stsClient, s.AssumeRoleARN, func(options *stscreds.AssumeRoleOptions) {
		if s.ExternalID != "" {
			options.ExternalID = aws.String(s.ExternalID)
		}
		if sessionDuration != nil {
			options.Duration = *sessionDuration
		}
	})
	cache := client.NewCredentialsCache(provider)
	return func(options *config.LoadOptions) error {
		options.Credentials = cache
		return nil
	}
}

func (s Settings) WithEC2RoleCredentials(client AWSAPIClient) LoadOptionsFunc {
	return func(options *config.LoadOptions) error {
		options.Credentials = client.NewEC2RoleCreds()
		return nil
	}
}

func (s Settings) WithHTTPClient() LoadOptionsFunc {
	return func(options *config.LoadOptions) error {
		if s.HTTPClient != nil {
			options.HTTPClient = s.HTTPClient
		}
		if options.HTTPClient == nil {
			client, err := httpclient.New()
			if err != nil {
				return err
			}
			options.HTTPClient = client
		}
		if s.ProxyOptions != nil {
			if client, ok := options.HTTPClient.(*http.Client); ok {
				if client.Transport == nil {
					client.Transport = httpclient.NewHTTPTransport()
				}
				if transport, ok := client.Transport.(*http.Transport); ok {
					err := proxy.New(s.ProxyOptions).ConfigureSecureSocksHTTPProxy(transport)
					if err != nil {
						return fmt.Errorf("error configuring Secure Socks proxy for Transport: %w", err)
					}
				} else {
					return fmt.Errorf("cfg.HTTPClient.Transport is not *http.Transport")
				}
			} else {
				return fmt.Errorf("cfg.HTTPClient is not *http.Client")
			}
		}
		return nil
	}
}

// WithUserAgent adds info to the UserAgent header of API requests.
// Adapted from grafana-aws-sdk/pkg/awsds/utils.go
func (s Settings) WithUserAgent() LoadOptionsFunc {
	buildInfo, err := build.GetBuildInfo()
	version := buildInfo.Version
	if err != nil {
		version = "dev"
	}
	grafanaVersion := os.Getenv("GF_VERSION")
	if grafanaVersion == "" {
		grafanaVersion = "?"
	}
	_, amgEnv := os.LookupEnv("AMAZON_MANAGED_GRAFANA")

	return func(options *config.LoadOptions) error {
		apiOpts := []func(*smithymiddleware.Stack) error{
			middleware.AddUserAgentKeyValue(aws.SDKName, aws.SDKVersion),
			middleware.AddUserAgentKey(fmt.Sprintf("(%s; %s;)", runtime.Version(), runtime.GOOS)),
		}
		if s.UserAgent != "" {
			apiOpts = append(apiOpts, middleware.AddUserAgentKeyValue(s.UserAgent, version))
		}
		apiOpts = append(apiOpts,
			middleware.AddUserAgentKeyValue("Grafana", grafanaVersion),
			middleware.AddUserAgentKeyValue("AMG", strconv.FormatBool(amgEnv)),
		)
		options.APIOptions = append(options.APIOptions, apiOpts...)
		return nil
	}
}
