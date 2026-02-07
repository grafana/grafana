package middleware

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

var languageVersion = strings.TrimPrefix(runtime.Version(), "go")

// SDKAgentKeyType is the metadata type to add to the SDK agent string
type SDKAgentKeyType int

// The set of valid SDKAgentKeyType constants. If an unknown value is assigned for SDKAgentKeyType it will
// be mapped to AdditionalMetadata.
const (
	_ SDKAgentKeyType = iota
	APIMetadata
	OperatingSystemMetadata
	LanguageMetadata
	EnvironmentMetadata
	FeatureMetadata
	ConfigMetadata
	FrameworkMetadata
	AdditionalMetadata
	ApplicationIdentifier
	FeatureMetadata2
)

// Hardcoded value to specify which version of the user agent we're using
const uaMetadata = "ua/2.1"

func (k SDKAgentKeyType) string() string {
	switch k {
	case APIMetadata:
		return "api"
	case OperatingSystemMetadata:
		return "os"
	case LanguageMetadata:
		return "lang"
	case EnvironmentMetadata:
		return "exec-env"
	case FeatureMetadata:
		return "ft"
	case ConfigMetadata:
		return "cfg"
	case FrameworkMetadata:
		return "lib"
	case ApplicationIdentifier:
		return "app"
	case FeatureMetadata2:
		return "m"
	case AdditionalMetadata:
		fallthrough
	default:
		return "md"
	}
}

const execEnvVar = `AWS_EXECUTION_ENV`

var validChars = map[rune]bool{
	'!': true, '#': true, '$': true, '%': true, '&': true, '\'': true, '*': true, '+': true,
	'-': true, '.': true, '^': true, '_': true, '`': true, '|': true, '~': true,
}

// UserAgentFeature enumerates tracked SDK features.
type UserAgentFeature string

// Enumerates UserAgentFeature.
const (
	UserAgentFeatureResourceModel UserAgentFeature = "A" // n/a (we don't generate separate resource types)

	UserAgentFeatureWaiter    = "B"
	UserAgentFeaturePaginator = "C"

	UserAgentFeatureRetryModeLegacy   = "D" // n/a (equivalent to standard)
	UserAgentFeatureRetryModeStandard = "E"
	UserAgentFeatureRetryModeAdaptive = "F"

	UserAgentFeatureS3Transfer      = "G"
	UserAgentFeatureS3CryptoV1N     = "H" // n/a (crypto client is external)
	UserAgentFeatureS3CryptoV2      = "I" // n/a
	UserAgentFeatureS3ExpressBucket = "J"
	UserAgentFeatureS3AccessGrants  = "K" // not yet implemented

	UserAgentFeatureGZIPRequestCompression = "L"

	UserAgentFeatureProtocolRPCV2CBOR = "M"

	UserAgentFeatureAccountIDEndpoint      = "O" // DO NOT IMPLEMENT: rules output is not currently defined. SDKs should not parse endpoints for feature information.
	UserAgentFeatureAccountIDModePreferred = "P"
	UserAgentFeatureAccountIDModeDisabled  = "Q"
	UserAgentFeatureAccountIDModeRequired  = "R"

	UserAgentFeatureRequestChecksumCRC32          = "U"
	UserAgentFeatureRequestChecksumCRC32C         = "V"
	UserAgentFeatureRequestChecksumCRC64          = "W"
	UserAgentFeatureRequestChecksumSHA1           = "X"
	UserAgentFeatureRequestChecksumSHA256         = "Y"
	UserAgentFeatureRequestChecksumWhenSupported  = "Z"
	UserAgentFeatureRequestChecksumWhenRequired   = "a"
	UserAgentFeatureResponseChecksumWhenSupported = "b"
	UserAgentFeatureResponseChecksumWhenRequired  = "c"

	UserAgentFeatureDynamoDBUserAgent = "d" // not yet implemented

	UserAgentFeatureCredentialsCode                 = "e"
	UserAgentFeatureCredentialsJvmSystemProperties  = "f" // n/a (this is not a JVM sdk)
	UserAgentFeatureCredentialsEnvVars              = "g"
	UserAgentFeatureCredentialsEnvVarsStsWebIDToken = "h"
	UserAgentFeatureCredentialsStsAssumeRole        = "i"
	UserAgentFeatureCredentialsStsAssumeRoleSaml    = "j" // not yet implemented
	UserAgentFeatureCredentialsStsAssumeRoleWebID   = "k"
	UserAgentFeatureCredentialsStsFederationToken   = "l" // not yet implemented
	UserAgentFeatureCredentialsStsSessionToken      = "m" // not yet implemented
	UserAgentFeatureCredentialsProfile              = "n"
	UserAgentFeatureCredentialsProfileSourceProfile = "o"
	UserAgentFeatureCredentialsProfileNamedProvider = "p"
	UserAgentFeatureCredentialsProfileStsWebIDToken = "q"
	UserAgentFeatureCredentialsProfileSso           = "r"
	UserAgentFeatureCredentialsSso                  = "s"
	UserAgentFeatureCredentialsProfileSsoLegacy     = "t"
	UserAgentFeatureCredentialsSsoLegacy            = "u"
	UserAgentFeatureCredentialsProfileProcess       = "v"
	UserAgentFeatureCredentialsProcess              = "w"
	UserAgentFeatureCredentialsBoto2ConfigFile      = "x" // n/a (this is not boto/Python)
	UserAgentFeatureCredentialsAwsSdkStore          = "y" // n/a (this is used by .NET based sdk)
	UserAgentFeatureCredentialsHTTP                 = "z"
	UserAgentFeatureCredentialsIMDS                 = "0"

	UserAgentFeatureBearerServiceEnvVars = "3"

	UserAgentFeatureCredentialsProfileLogin = "AC"
	UserAgentFeatureCredentialsLogin        = "AD"
)

var credentialSourceToFeature = map[aws.CredentialSource]UserAgentFeature{
	aws.CredentialSourceCode:                 UserAgentFeatureCredentialsCode,
	aws.CredentialSourceEnvVars:              UserAgentFeatureCredentialsEnvVars,
	aws.CredentialSourceEnvVarsSTSWebIDToken: UserAgentFeatureCredentialsEnvVarsStsWebIDToken,
	aws.CredentialSourceSTSAssumeRole:        UserAgentFeatureCredentialsStsAssumeRole,
	aws.CredentialSourceSTSAssumeRoleSaml:    UserAgentFeatureCredentialsStsAssumeRoleSaml,
	aws.CredentialSourceSTSAssumeRoleWebID:   UserAgentFeatureCredentialsStsAssumeRoleWebID,
	aws.CredentialSourceSTSFederationToken:   UserAgentFeatureCredentialsStsFederationToken,
	aws.CredentialSourceSTSSessionToken:      UserAgentFeatureCredentialsStsSessionToken,
	aws.CredentialSourceProfile:              UserAgentFeatureCredentialsProfile,
	aws.CredentialSourceProfileSourceProfile: UserAgentFeatureCredentialsProfileSourceProfile,
	aws.CredentialSourceProfileNamedProvider: UserAgentFeatureCredentialsProfileNamedProvider,
	aws.CredentialSourceProfileSTSWebIDToken: UserAgentFeatureCredentialsProfileStsWebIDToken,
	aws.CredentialSourceProfileSSO:           UserAgentFeatureCredentialsProfileSso,
	aws.CredentialSourceSSO:                  UserAgentFeatureCredentialsSso,
	aws.CredentialSourceProfileSSOLegacy:     UserAgentFeatureCredentialsProfileSsoLegacy,
	aws.CredentialSourceSSOLegacy:            UserAgentFeatureCredentialsSsoLegacy,
	aws.CredentialSourceProfileProcess:       UserAgentFeatureCredentialsProfileProcess,
	aws.CredentialSourceProcess:              UserAgentFeatureCredentialsProcess,
	aws.CredentialSourceHTTP:                 UserAgentFeatureCredentialsHTTP,
	aws.CredentialSourceIMDS:                 UserAgentFeatureCredentialsIMDS,
	aws.CredentialSourceProfileLogin:         UserAgentFeatureCredentialsProfileLogin,
	aws.CredentialSourceLogin:                UserAgentFeatureCredentialsLogin,
}

// RequestUserAgent is a build middleware that set the User-Agent for the request.
type RequestUserAgent struct {
	sdkAgent, userAgent *smithyhttp.UserAgentBuilder
	features            map[UserAgentFeature]struct{}
}

// NewRequestUserAgent returns a new requestUserAgent which will set the User-Agent and X-Amz-User-Agent for the
// request.
//
// User-Agent example:
//
//	aws-sdk-go-v2/1.2.3
//
// X-Amz-User-Agent example:
//
//	aws-sdk-go-v2/1.2.3 md/GOOS/linux md/GOARCH/amd64 lang/go/1.15
func NewRequestUserAgent() *RequestUserAgent {
	userAgent, sdkAgent := smithyhttp.NewUserAgentBuilder(), smithyhttp.NewUserAgentBuilder()
	addProductName(userAgent)
	addUserAgentMetadata(userAgent)
	addProductName(sdkAgent)

	r := &RequestUserAgent{
		sdkAgent:  sdkAgent,
		userAgent: userAgent,
		features:  map[UserAgentFeature]struct{}{},
	}

	addSDKMetadata(r)

	return r
}

func addSDKMetadata(r *RequestUserAgent) {
	r.AddSDKAgentKey(OperatingSystemMetadata, getNormalizedOSName())
	r.AddSDKAgentKeyValue(LanguageMetadata, "go", languageVersion)
	r.AddSDKAgentKeyValue(AdditionalMetadata, "GOOS", runtime.GOOS)
	r.AddSDKAgentKeyValue(AdditionalMetadata, "GOARCH", runtime.GOARCH)
	if ev := os.Getenv(execEnvVar); len(ev) > 0 {
		r.AddSDKAgentKey(EnvironmentMetadata, ev)
	}
}

func addProductName(builder *smithyhttp.UserAgentBuilder) {
	builder.AddKeyValue(aws.SDKName, aws.SDKVersion)
}

func addUserAgentMetadata(builder *smithyhttp.UserAgentBuilder) {
	builder.AddKey(uaMetadata)
}

// AddUserAgentKey retrieves a requestUserAgent from the provided stack, or initializes one.
func AddUserAgentKey(key string) func(*middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		requestUserAgent, err := getOrAddRequestUserAgent(stack)
		if err != nil {
			return err
		}
		requestUserAgent.AddUserAgentKey(key)
		return nil
	}
}

// AddUserAgentKeyValue retrieves a requestUserAgent from the provided stack, or initializes one.
func AddUserAgentKeyValue(key, value string) func(*middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		requestUserAgent, err := getOrAddRequestUserAgent(stack)
		if err != nil {
			return err
		}
		requestUserAgent.AddUserAgentKeyValue(key, value)
		return nil
	}
}

// AddSDKAgentKey retrieves a requestUserAgent from the provided stack, or initializes one.
func AddSDKAgentKey(keyType SDKAgentKeyType, key string) func(*middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		requestUserAgent, err := getOrAddRequestUserAgent(stack)
		if err != nil {
			return err
		}
		requestUserAgent.AddSDKAgentKey(keyType, key)
		return nil
	}
}

// AddSDKAgentKeyValue retrieves a requestUserAgent from the provided stack, or initializes one.
func AddSDKAgentKeyValue(keyType SDKAgentKeyType, key, value string) func(*middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		requestUserAgent, err := getOrAddRequestUserAgent(stack)
		if err != nil {
			return err
		}
		requestUserAgent.AddSDKAgentKeyValue(keyType, key, value)
		return nil
	}
}

// AddRequestUserAgentMiddleware registers a requestUserAgent middleware on the stack if not present.
func AddRequestUserAgentMiddleware(stack *middleware.Stack) error {
	_, err := getOrAddRequestUserAgent(stack)
	return err
}

func getOrAddRequestUserAgent(stack *middleware.Stack) (*RequestUserAgent, error) {
	id := (*RequestUserAgent)(nil).ID()
	bm, ok := stack.Build.Get(id)
	if !ok {
		bm = NewRequestUserAgent()
		err := stack.Build.Add(bm, middleware.After)
		if err != nil {
			return nil, err
		}
	}

	requestUserAgent, ok := bm.(*RequestUserAgent)
	if !ok {
		return nil, fmt.Errorf("%T for %s middleware did not match expected type", bm, id)
	}

	return requestUserAgent, nil
}

// AddUserAgentKey adds the component identified by name to the User-Agent string.
func (u *RequestUserAgent) AddUserAgentKey(key string) {
	u.userAgent.AddKey(strings.Map(rules, key))
}

// AddUserAgentKeyValue adds the key identified by the given name and value to the User-Agent string.
func (u *RequestUserAgent) AddUserAgentKeyValue(key, value string) {
	u.userAgent.AddKeyValue(strings.Map(rules, key), strings.Map(rules, value))
}

// AddUserAgentFeature adds the feature ID to the tracking list to be emitted
// in the final User-Agent string.
func (u *RequestUserAgent) AddUserAgentFeature(feature UserAgentFeature) {
	u.features[feature] = struct{}{}
}

// AddSDKAgentKey adds the component identified by name to the User-Agent string.
func (u *RequestUserAgent) AddSDKAgentKey(keyType SDKAgentKeyType, key string) {
	// TODO: should target sdkAgent
	u.userAgent.AddKey(keyType.string() + "/" + strings.Map(rules, key))
}

// AddSDKAgentKeyValue adds the key identified by the given name and value to the User-Agent string.
func (u *RequestUserAgent) AddSDKAgentKeyValue(keyType SDKAgentKeyType, key, value string) {
	// TODO: should target sdkAgent
	u.userAgent.AddKeyValue(keyType.string(), strings.Map(rules, key)+"#"+strings.Map(rules, value))
}

// AddCredentialsSource adds the credential source as a feature on the User-Agent string
func (u *RequestUserAgent) AddCredentialsSource(source aws.CredentialSource) {
	x, ok := credentialSourceToFeature[source]
	if ok {
		u.AddUserAgentFeature(x)
	}
}

// ID the name of the middleware.
func (u *RequestUserAgent) ID() string {
	return "UserAgent"
}

// HandleBuild adds or appends the constructed user agent to the request.
func (u *RequestUserAgent) HandleBuild(ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	switch req := in.Request.(type) {
	case *smithyhttp.Request:
		u.addHTTPUserAgent(req)
		// TODO: To be re-enabled
		// u.addHTTPSDKAgent(req)
	default:
		return out, metadata, fmt.Errorf("unknown transport type %T", in)
	}

	return next.HandleBuild(ctx, in)
}

func (u *RequestUserAgent) addHTTPUserAgent(request *smithyhttp.Request) {
	const userAgent = "User-Agent"
	if len(u.features) > 0 {
		updateHTTPHeader(request, userAgent, buildFeatureMetrics(u.features))
	}
	updateHTTPHeader(request, userAgent, u.userAgent.Build())
}

func (u *RequestUserAgent) addHTTPSDKAgent(request *smithyhttp.Request) {
	const sdkAgent = "X-Amz-User-Agent"
	updateHTTPHeader(request, sdkAgent, u.sdkAgent.Build())
}

func updateHTTPHeader(request *smithyhttp.Request, header string, value string) {
	var current string
	if v := request.Header[header]; len(v) > 0 {
		current = v[0]
	}
	if len(current) > 0 {
		current = value + " " + current
	} else {
		current = value
	}
	request.Header[header] = append(request.Header[header][:0], current)
}

func rules(r rune) rune {
	switch {
	case r >= '0' && r <= '9':
		return r
	case r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z':
		return r
	case validChars[r]:
		return r
	default:
		return '-'
	}
}

func buildFeatureMetrics(features map[UserAgentFeature]struct{}) string {
	fs := make([]string, 0, len(features))
	for f := range features {
		fs = append(fs, string(f))
	}

	sort.Strings(fs)
	return fmt.Sprintf("%s/%s", FeatureMetadata2.string(), strings.Join(fs, ","))
}
