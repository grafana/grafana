// Package defaults is a collection of helpers to retrieve the SDK's default
// configuration and handlers.
//
// Generally this package shouldn't be used directly, but session.Session
// instead. This package is useful when you need to reset the defaults
// of a session or service client to the SDK defaults before setting
// additional parameters.
package defaults

import (
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/corehandlers"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/endpoints"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/internal/shareddefaults"
)

// A Defaults provides a collection of default values for SDK clients.
type Defaults struct {
	Config   *aws.Config
	Handlers request.Handlers
}

// Get returns the SDK's default values with Config and handlers pre-configured.
func Get() Defaults {
	cfg := Config()
	handlers := Handlers()
	cfg.Credentials = CredChain(cfg, handlers)

	return Defaults{
		Config:   cfg,
		Handlers: handlers,
	}
}

// Config returns the default configuration without credentials.
// To retrieve a config with credentials also included use
// `defaults.Get().Config` instead.
//
// Generally you shouldn't need to use this method directly, but
// is available if you need to reset the configuration of an
// existing service client or session.
func Config() *aws.Config {
	return aws.NewConfig().
		WithCredentials(credentials.AnonymousCredentials).
		WithRegion(os.Getenv("AWS_REGION")).
		WithHTTPClient(http.DefaultClient).
		WithMaxRetries(aws.UseServiceDefaultRetries).
		WithLogger(aws.NewDefaultLogger()).
		WithLogLevel(aws.LogOff).
		WithEndpointResolver(endpoints.DefaultResolver())
}

// Handlers returns the default request handlers.
//
// Generally you shouldn't need to use this method directly, but
// is available if you need to reset the request handlers of an
// existing service client or session.
func Handlers() request.Handlers {
	var handlers request.Handlers

	handlers.Validate.PushBackNamed(corehandlers.ValidateEndpointHandler)
	handlers.Validate.AfterEachFn = request.HandlerListStopOnError
	handlers.Build.PushBackNamed(corehandlers.SDKVersionUserAgentHandler)
	handlers.Build.PushBackNamed(corehandlers.AddAwsInternal)
	handlers.Build.PushBackNamed(corehandlers.AddHostExecEnvUserAgentHander)
	handlers.Build.AfterEachFn = request.HandlerListStopOnError
	handlers.Sign.PushBackNamed(corehandlers.BuildContentLengthHandler)
	handlers.Send.PushBackNamed(corehandlers.ValidateReqSigHandler)
	handlers.Send.PushBackNamed(corehandlers.SendHandler)
	handlers.AfterRetry.PushBackNamed(corehandlers.AfterRetryHandler)
	handlers.ValidateResponse.PushBackNamed(corehandlers.ValidateResponseHandler)

	return handlers
}

// CredChain returns the default credential chain.
//
// Generally you shouldn't need to use this method directly, but
// is available if you need to reset the credentials of an
// existing service client or session's Config.
func CredChain(cfg *aws.Config, handlers request.Handlers) *credentials.Credentials {
	return credentials.NewCredentials(&credentials.ChainProvider{
		VerboseErrors: aws.BoolValue(cfg.CredentialsChainVerboseErrors),
		Providers:     CredProviders(cfg, handlers),
	})
}

// CredProviders returns the slice of providers used in
// the default credential chain.
//
// For applications that need to use some other provider (for example use
// different  environment variables for legacy reasons) but still fall back
// on the default chain of providers. This allows that default chaint to be
// automatically updated
func CredProviders(cfg *aws.Config, handlers request.Handlers) []credentials.Provider {
	return []credentials.Provider{
		&credentials.EnvProvider{},
		&credentials.SharedCredentialsProvider{Filename: "", Profile: ""},
		RemoteCredProvider(*cfg, handlers),
	}
}

const (
	httpProviderAuthorizationEnvVar = "AWS_CONTAINER_AUTHORIZATION_TOKEN"
	httpProviderAuthFileEnvVar      = "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE"
	httpProviderEnvVar              = "AWS_CONTAINER_CREDENTIALS_FULL_URI"
)

// direct representation of the IPv4 address for the ECS container
// "169.254.170.2"
var ecsContainerIPv4 net.IP = []byte{
	169, 254, 170, 2,
}

// direct representation of the IPv4 address for the EKS container
// "169.254.170.23"
var eksContainerIPv4 net.IP = []byte{
	169, 254, 170, 23,
}

// direct representation of the IPv6 address for the EKS container
// "fd00:ec2::23"
var eksContainerIPv6 net.IP = []byte{
	0xFD, 0, 0xE, 0xC2,
	0, 0, 0, 0,
	0, 0, 0, 0,
	0, 0, 0, 0x23,
}

// RemoteCredProvider returns a credentials provider for the default remote
// endpoints such as EC2 or ECS Roles.
func RemoteCredProvider(cfg aws.Config, handlers request.Handlers) credentials.Provider {
	if u := os.Getenv(httpProviderEnvVar); len(u) > 0 {
		return localHTTPCredProvider(cfg, handlers, u)
	}

	if uri := os.Getenv(shareddefaults.ECSCredsProviderEnvVar); len(uri) > 0 {
		u := fmt.Sprintf("%s%s", shareddefaults.ECSContainerCredentialsURI, uri)
		return httpCredProvider(cfg, handlers, u)
	}

	return ec2RoleProvider(cfg, handlers)
}

var lookupHostFn = net.LookupHost

// isAllowedHost allows host to be loopback or known ECS/EKS container IPs
//
// host can either be an IP address OR an unresolved hostname - resolution will
// be automatically performed in the latter case
func isAllowedHost(host string) (bool, error) {
	if ip := net.ParseIP(host); ip != nil {
		return isIPAllowed(ip), nil
	}

	addrs, err := lookupHostFn(host)
	if err != nil {
		return false, err
	}

	for _, addr := range addrs {
		if ip := net.ParseIP(addr); ip == nil || !isIPAllowed(ip) {
			return false, nil
		}
	}

	return true, nil
}

func isIPAllowed(ip net.IP) bool {
	return ip.IsLoopback() ||
		ip.Equal(ecsContainerIPv4) ||
		ip.Equal(eksContainerIPv4) ||
		ip.Equal(eksContainerIPv6)
}

func localHTTPCredProvider(cfg aws.Config, handlers request.Handlers, u string) credentials.Provider {
	var errMsg string

	parsed, err := url.Parse(u)
	if err != nil {
		errMsg = fmt.Sprintf("invalid URL, %v", err)
	} else {
		host := aws.URLHostname(parsed)
		if len(host) == 0 {
			errMsg = "unable to parse host from local HTTP cred provider URL"
		} else if parsed.Scheme == "http" {
			if isAllowedHost, allowHostErr := isAllowedHost(host); allowHostErr != nil {
				errMsg = fmt.Sprintf("failed to resolve host %q, %v", host, allowHostErr)
			} else if !isAllowedHost {
				errMsg = fmt.Sprintf("invalid endpoint host, %q, only loopback/ecs/eks hosts are allowed.", host)
			}
		}
	}

	if len(errMsg) > 0 {
		if cfg.Logger != nil {
			cfg.Logger.Log("Ignoring, HTTP credential provider", errMsg, err)
		}
		return credentials.ErrorProvider{
			Err:          awserr.New("CredentialsEndpointError", errMsg, err),
			ProviderName: endpointcreds.ProviderName,
		}
	}

	return httpCredProvider(cfg, handlers, u)
}

func httpCredProvider(cfg aws.Config, handlers request.Handlers, u string) credentials.Provider {
	return endpointcreds.NewProviderClient(cfg, handlers, u,
		func(p *endpointcreds.Provider) {
			p.ExpiryWindow = 5 * time.Minute
			p.AuthorizationToken = os.Getenv(httpProviderAuthorizationEnvVar)
			if authFilePath := os.Getenv(httpProviderAuthFileEnvVar); authFilePath != "" {
				p.AuthorizationTokenProvider = endpointcreds.TokenProviderFunc(func() (string, error) {
					if contents, err := ioutil.ReadFile(authFilePath); err != nil {
						return "", fmt.Errorf("failed to read authorization token from %v: %v", authFilePath, err)
					} else {
						return string(contents), nil
					}
				})
			}
		},
	)
}

func ec2RoleProvider(cfg aws.Config, handlers request.Handlers) credentials.Provider {
	resolver := cfg.EndpointResolver
	if resolver == nil {
		resolver = endpoints.DefaultResolver()
	}

	e, _ := resolver.EndpointFor(endpoints.Ec2metadataServiceID, "")
	return &ec2rolecreds.EC2RoleProvider{
		Client:       ec2metadata.NewClient(cfg, handlers, e.URL, e.SigningRegion),
		ExpiryWindow: 5 * time.Minute,
	}
}
