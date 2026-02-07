// Copyright 2018 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package aws provides fundamental Wire providers for Amazon Web Services (AWS).
package aws // import "gocloud.dev/aws"

import (
	"context"
	"fmt"
	"net/url"
	"strconv"

	awsv2 "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/endpoints"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/google/wire"
)

// DefaultSession is a Wire provider set that provides a *session.Session using
// the default options.
var DefaultSession = wire.NewSet(
	SessionConfig,
	ConfigCredentials,
	NewDefaultSession,
	wire.Bind(new(client.ConfigProvider), new(*session.Session)),
)

// NewDefaultSession returns a *session.Session using the default options.
func NewDefaultSession() (*session.Session, error) {
	return session.NewSessionWithOptions(session.Options{SharedConfigState: session.SharedConfigEnable})
}

// SessionConfig returns sess.Config.
func SessionConfig(sess *session.Session) *aws.Config {
	return sess.Config
}

// ConfigCredentials returns cfg.Credentials.
func ConfigCredentials(cfg *aws.Config) *credentials.Credentials {
	return cfg.Credentials
}

// ConfigOverrider implements client.ConfigProvider by overlaying a list of
// configurations over a base configuration provider.
type ConfigOverrider struct {
	Base    client.ConfigProvider
	Configs []*aws.Config
}

// ClientConfig calls the base provider's ClientConfig method with co.Configs
// followed by the arguments given to ClientConfig.
func (co ConfigOverrider) ClientConfig(serviceName string, cfgs ...*aws.Config) client.Config {
	cfgs = append(co.Configs[:len(co.Configs):len(co.Configs)], cfgs...)
	return co.Base.ClientConfig(serviceName, cfgs...)
}

// ConfigFromURLParams returns an aws.Config initialized based on the URL
// parameters in q. It is intended to be used by URLOpeners for AWS services.
// https://docs.aws.amazon.com/sdk-for-go/api/aws/#Config
//
// It returns an error if q contains any unknown query parameters; callers
// should remove any query parameters they know about from q before calling
// ConfigFromURLParams.
//
// The following query options are supported:
//   - region: The AWS region for requests; sets aws.Config.Region.
//   - endpoint: The endpoint URL (hostname only or fully qualified URI); sets aws.Config.Endpoint.
//   - disable_ssl (or disableSSL): A value of "true" disables SSL when sending requests; sets aws.Config.DisableSSL.
//   - s3_force_path_style (or s3ForcePathStyle): A value of "true" forces the request to use path-style addressing; sets aws.Config.S3ForcePathStyle.
//   - dualstack: A value of "true" enables dual stack (IPv4 and IPv6) endpoints
//   - fips: A value of "true" enables the use of FIPS endpoints
func ConfigFromURLParams(q url.Values) (*aws.Config, error) {
	var cfg aws.Config
	for param, values := range q {
		value := values[0]
		switch param {
		case "region":
			cfg.Region = aws.String(value)
		case "endpoint":
			cfg.Endpoint = aws.String(value)
		case "disable_ssl", "disableSSL":
			b, err := strconv.ParseBool(value)
			if err != nil {
				return nil, fmt.Errorf("invalid value for query parameter %q: %v", param, err)
			}
			cfg.DisableSSL = aws.Bool(b)
		case "s3_force_path_style", "s3ForcePathStyle":
			b, err := strconv.ParseBool(value)
			if err != nil {
				return nil, fmt.Errorf("invalid value for query parameter %q: %v", param, err)
			}
			cfg.S3ForcePathStyle = aws.Bool(b)
		case "dualstack":
			b, err := strconv.ParseBool(value)
			if err != nil {
				return nil, fmt.Errorf("invalid value for query parameter %q: %v", param, err)
			}
			cfg.UseDualStack = aws.Bool(b)
		case "fips":
			b, err := strconv.ParseBool(value)
			if err != nil {
				return nil, fmt.Errorf("invalid value for query parameter %q: %v", param, err)
			}
			if b {
				cfg.UseFIPSEndpoint = endpoints.FIPSEndpointStateEnabled
			}
		case "awssdk":
			// ignore, should be handled before this
		default:
			return nil, fmt.Errorf("unknown query parameter %q", param)
		}
	}
	return &cfg, nil
}

// NewSessionFromURLParams returns an session.Session with session.Options initialized based on the URL
// parameters in q. It is intended to be used by URLOpeners for AWS services.
// https://docs.aws.amazon.com/sdk-for-go/api/aws/session/#Session
//
// It should be used before ConfigFromURLParams as it strips the query
// parameters it knows about
//
// The following query options are supported:
//   - profile: The AWS profile to use from the AWS configs (shared config file and
//     shared credentials file)
func NewSessionFromURLParams(q url.Values) (*session.Session, url.Values, error) {
	// always enable shared config (~/.aws/config by default)
	opts := session.Options{SharedConfigState: session.SharedConfigEnable}
	rest := url.Values{}
	for param, values := range q {
		value := values[0]
		switch param {
		case "profile":
			opts.Profile = value
		case "awssdk":
			// ignore, should be handled before this
		default:
			rest.Add(param, value)
		}
	}
	sess, err := session.NewSessionWithOptions(opts)
	if err != nil {
		return nil, nil, fmt.Errorf("couldn't create session %w", err)
	}
	return sess, rest, nil
}

// UseV2 returns true iff the URL parameters indicate that the provider
// should use the AWS SDK v2.
//
// "awssdk=v1" will force V1.
// "awssdk=v2" will force V2.
// No "awssdk" parameter (or any other value) will return the default, currently V2.
func UseV2(q url.Values) bool {
	if values, ok := q["awssdk"]; ok {
		if values[0] == "v1" || values[0] == "V1" {
			return false
		}
	}
	return true
}

// NewDefaultV2Config returns a aws.Config for AWS SDK v2, using the default options.
func NewDefaultV2Config(ctx context.Context) (awsv2.Config, error) {
	return config.LoadDefaultConfig(ctx)
}

// V2ConfigFromURLParams returns an aws.Config for AWS SDK v2 initialized based on the URL
// parameters in q. It is intended to be used by URLOpeners for AWS services if
// UseV2 returns true.
//
// https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/aws#Config
//
// It returns an error if q contains any unknown query parameters; callers
// should remove any query parameters they know about from q before calling
// V2ConfigFromURLParams.
//
// The following query options are supported:
//   - region: The AWS region for requests; sets WithRegion.
//   - anonymous: A value of "true" forces use of anonymous credentials.
//   - profile: The shared config profile to use; sets SharedConfigProfile.
//   - endpoint: The AWS service endpoint to send HTTP request.
//   - hostname_immutable: Make the hostname immutable, only works if endpoint is also set.
//   - dualstack: A value of "true" enables dual stack (IPv4 and IPv6) endpoints.
//   - fips: A value of "true" enables the use of FIPS endpoints.
//   - rate_limiter_capacity: A integer value configures the capacity of a token bucket used
//     in client-side rate limits. If no value is set, the client-side rate limiting is disabled.
//     See https://aws.github.io/aws-sdk-go-v2/docs/configuring-sdk/retries-timeouts/#client-side-rate-limiting.
func V2ConfigFromURLParams(ctx context.Context, q url.Values) (awsv2.Config, error) {
	var endpoint string
	var hostnameImmutable bool
	var rateLimitCapacity int64
	var opts []func(*config.LoadOptions) error
	for param, values := range q {
		value := values[0]
		switch param {
		case "hostname_immutable":
			var err error
			hostnameImmutable, err = strconv.ParseBool(value)
			if err != nil {
				return awsv2.Config{}, fmt.Errorf("invalid value for hostname_immutable: %w", err)
			}
		case "region":
			opts = append(opts, config.WithRegion(value))
		case "endpoint":
			endpoint = value
		case "profile":
			opts = append(opts, config.WithSharedConfigProfile(value))
		case "dualstack":
			dualStack, err := strconv.ParseBool(value)
			if err != nil {
				return awsv2.Config{}, fmt.Errorf("invalid value for dualstack: %w", err)
			}
			if dualStack {
				opts = append(opts, config.WithUseDualStackEndpoint(awsv2.DualStackEndpointStateEnabled))
			}
		case "fips":
			fips, err := strconv.ParseBool(value)
			if err != nil {
				return awsv2.Config{}, fmt.Errorf("invalid value for fips: %w", err)
			}
			if fips {
				opts = append(opts, config.WithUseFIPSEndpoint(awsv2.FIPSEndpointStateEnabled))
			}
		case "rate_limiter_capacity":
			var err error
			rateLimitCapacity, err = strconv.ParseInt(value, 10, 32)
			if err != nil {
				return awsv2.Config{}, fmt.Errorf("invalid value for capacity: %w", err)
			}
		case "anonymous":
			anon, err := strconv.ParseBool(value)
			if err != nil {
				return awsv2.Config{}, fmt.Errorf("invalid value for anonymous: %w", err)
			}
			if anon {
				opts = append(opts, config.WithCredentialsProvider(awsv2.AnonymousCredentials{}))
			}
		case "awssdk":
			// ignore, should be handled before this
		default:
			return awsv2.Config{}, fmt.Errorf("unknown query parameter %q", param)
		}
	}
	if endpoint != "" {
		customResolver := awsv2.EndpointResolverWithOptionsFunc(
			func(service, region string, options ...any) (awsv2.Endpoint, error) {
				return awsv2.Endpoint{
					PartitionID:       "aws",
					URL:               endpoint,
					SigningRegion:     region,
					HostnameImmutable: hostnameImmutable,
				}, nil
			})
		opts = append(opts, config.WithEndpointResolverWithOptions(customResolver))
	}

	var rateLimiter retry.RateLimiter
	rateLimiter = ratelimit.None
	if rateLimitCapacity > 0 {
		rateLimiter = ratelimit.NewTokenRateLimit(uint(rateLimitCapacity))
	}
	opts = append(opts, config.WithRetryer(func() awsv2.Retryer {
		return retry.NewStandard(func(so *retry.StandardOptions) {
			so.RateLimiter = rateLimiter
		})
	}))

	return config.LoadDefaultConfig(ctx, opts...)
}
