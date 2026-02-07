package registry // import "github.com/docker/docker/api/types/registry"
import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// AuthHeader is the name of the header used to send encoded registry
// authorization credentials for registry operations (push/pull).
const AuthHeader = "X-Registry-Auth"

// RequestAuthConfig is a function interface that clients can supply
// to retry operations after getting an authorization error.
//
// The function must return the [AuthHeader] value ([AuthConfig]), encoded
// in base64url format ([RFC4648, section 5]), which can be decoded by
// [DecodeAuthConfig].
//
// It must return an error if the privilege request fails.
//
// [RFC4648, section 5]: https://tools.ietf.org/html/rfc4648#section-5
type RequestAuthConfig func(context.Context) (string, error)

// AuthConfig contains authorization information for connecting to a Registry.
type AuthConfig struct {
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Auth     string `json:"auth,omitempty"`

	// Email is an optional value associated with the username.
	// This field is deprecated and will be removed in a later
	// version of docker.
	Email string `json:"email,omitempty"`

	ServerAddress string `json:"serveraddress,omitempty"`

	// IdentityToken is used to authenticate the user and get
	// an access token for the registry.
	IdentityToken string `json:"identitytoken,omitempty"`

	// RegistryToken is a bearer token to be sent to a registry
	RegistryToken string `json:"registrytoken,omitempty"`
}

// EncodeAuthConfig serializes the auth configuration as a base64url encoded
// ([RFC4648, section 5]) JSON string for sending through the X-Registry-Auth header.
//
// [RFC4648, section 5]: https://tools.ietf.org/html/rfc4648#section-5
func EncodeAuthConfig(authConfig AuthConfig) (string, error) {
	buf, err := json.Marshal(authConfig)
	if err != nil {
		return "", errInvalidParameter{err}
	}
	return base64.URLEncoding.EncodeToString(buf), nil
}

// DecodeAuthConfig decodes base64url encoded ([RFC4648, section 5]) JSON
// authentication information as sent through the X-Registry-Auth header.
//
// This function always returns an [AuthConfig], even if an error occurs. It is up
// to the caller to decide if authentication is required, and if the error can
// be ignored.
//
// [RFC4648, section 5]: https://tools.ietf.org/html/rfc4648#section-5
func DecodeAuthConfig(authEncoded string) (*AuthConfig, error) {
	if authEncoded == "" {
		return &AuthConfig{}, nil
	}

	authJSON := base64.NewDecoder(base64.URLEncoding, strings.NewReader(authEncoded))
	return decodeAuthConfigFromReader(authJSON)
}

// DecodeAuthConfigBody decodes authentication information as sent as JSON in the
// body of a request. This function is to provide backward compatibility with old
// clients and API versions. Current clients and API versions expect authentication
// to be provided through the X-Registry-Auth header.
//
// Like [DecodeAuthConfig], this function always returns an [AuthConfig], even if an
// error occurs. It is up to the caller to decide if authentication is required,
// and if the error can be ignored.
func DecodeAuthConfigBody(rdr io.ReadCloser) (*AuthConfig, error) {
	return decodeAuthConfigFromReader(rdr)
}

func decodeAuthConfigFromReader(rdr io.Reader) (*AuthConfig, error) {
	authConfig := &AuthConfig{}
	if err := json.NewDecoder(rdr).Decode(authConfig); err != nil {
		// always return an (empty) AuthConfig to increase compatibility with
		// the existing API.
		return &AuthConfig{}, invalid(err)
	}
	return authConfig, nil
}

func invalid(err error) error {
	return errInvalidParameter{fmt.Errorf("invalid X-Registry-Auth header: %w", err)}
}

type errInvalidParameter struct{ error }

func (errInvalidParameter) InvalidParameter() {}

func (e errInvalidParameter) Cause() error { return e.error }

func (e errInvalidParameter) Unwrap() error { return e.error }
