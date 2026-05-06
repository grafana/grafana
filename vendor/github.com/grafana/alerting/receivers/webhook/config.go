package webhook

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

type CustomPayload struct {
	// Template is the template used to generate the payload for the webhook.
	Template string `json:"template,omitempty" yaml:"template,omitempty"`

	// Vars is a map of variables that can be used in the payload template. This is useful for providing
	// additional context to the payload template without storing it in the template itself.
	// Variables are accessible in the template through `.Vars.<key>`.
	Vars map[string]string `json:"vars,omitempty" yaml:"vars,omitempty"`
}

type Config struct {
	URL        string
	HTTPMethod string
	MaxAlerts  int
	// Authorization Header.
	AuthorizationScheme      string
	AuthorizationCredentials string
	// HTTP Basic Authentication.
	User         string
	Password     string
	ExtraHeaders map[string]string

	Title      string
	Message    string
	TLSConfig  *receivers.TLSConfig
	HMACConfig *receivers.HMACConfig

	Payload CustomPayload
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	rawSettings := struct {
		URL                      string                   `json:"url,omitempty" yaml:"url,omitempty"`
		HTTPMethod               string                   `json:"httpMethod,omitempty" yaml:"httpMethod,omitempty"`
		MaxAlerts                receivers.OptionalNumber `json:"maxAlerts,omitempty" yaml:"maxAlerts,omitempty"`
		AuthorizationScheme      string                   `json:"authorization_scheme,omitempty" yaml:"authorization_scheme,omitempty"`
		AuthorizationCredentials string                   `json:"authorization_credentials,omitempty" yaml:"authorization_credentials,omitempty"`
		User                     string                   `json:"username,omitempty" yaml:"username,omitempty"`
		Password                 string                   `json:"password,omitempty" yaml:"password,omitempty"`
		Title                    string                   `json:"title,omitempty" yaml:"title,omitempty"`
		Message                  string                   `json:"message,omitempty" yaml:"message,omitempty"`
		TLSConfig                *receivers.TLSConfig     `json:"tlsConfig,omitempty" yaml:"tlsConfig,omitempty"`
		HMACConfig               *receivers.HMACConfig    `json:"hmacConfig,omitempty" yaml:"hmacConfig,omitempty"`
		ExtraHeaders             map[string]string        `json:"headers,omitempty" yaml:"headers,omitempty"`

		Payload *CustomPayload `json:"payload,omitempty" yaml:"payload,omitempty"`
	}{}

	err := json.Unmarshal(jsonData, &rawSettings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if rawSettings.URL == "" {
		return settings, errors.New("required field 'url' is not specified")
	}
	settings.URL = rawSettings.URL
	settings.AuthorizationScheme = rawSettings.AuthorizationScheme

	if rawSettings.HTTPMethod == "" {
		rawSettings.HTTPMethod = http.MethodPost
	}
	settings.HTTPMethod = rawSettings.HTTPMethod

	if rawSettings.MaxAlerts != "" {
		settings.MaxAlerts, _ = strconv.Atoi(rawSettings.MaxAlerts.String())
	}

	settings.User = decryptFn("username", rawSettings.User)
	settings.Password = decryptFn("password", rawSettings.Password)
	settings.AuthorizationCredentials = decryptFn("authorization_credentials", rawSettings.AuthorizationCredentials)

	if settings.AuthorizationCredentials != "" && settings.AuthorizationScheme == "" {
		settings.AuthorizationScheme = "Bearer"
	}
	if settings.User != "" && settings.Password != "" && settings.AuthorizationScheme != "" && settings.AuthorizationCredentials != "" {
		return settings, errors.New("both HTTP Basic Authentication and Authorization Header are set, only 1 is permitted")
	}

	if rawSettings.Payload != nil {
		settings.Payload = *rawSettings.Payload
	}

	settings.Title = rawSettings.Title
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	settings.Message = rawSettings.Message
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}

	if tlsConfig := rawSettings.TLSConfig; tlsConfig != nil {
		settings.TLSConfig = &receivers.TLSConfig{
			InsecureSkipVerify: tlsConfig.InsecureSkipVerify,
			CACertificate:      decryptFn("tlsConfig.caCertificate", tlsConfig.CACertificate),
			ClientCertificate:  decryptFn("tlsConfig.clientCertificate", tlsConfig.ClientCertificate),
			ClientKey:          decryptFn("tlsConfig.clientKey", tlsConfig.ClientKey),
		}
	}

	if hmacConfig := rawSettings.HMACConfig; hmacConfig != nil {
		settings.HMACConfig = &receivers.HMACConfig{
			Secret:          decryptFn("hmacConfig.secret", hmacConfig.Secret),
			Header:          hmacConfig.Header,
			TimestampHeader: hmacConfig.TimestampHeader,
		}
	}

	if rawSettings.ExtraHeaders != nil {
		if _, removed := OmitRestrictedHeaders(rawSettings.ExtraHeaders); len(removed) > 0 {
			// Sort for deterministic error message.
			sort.Strings(removed)
			return settings, fmt.Errorf("custom headers %q are not allowed", removed)
		}
		settings.ExtraHeaders = rawSettings.ExtraHeaders
	}

	return settings, err
}

// restrictedHeaders is a list of HTTP headers that should not be set by the user.
var restrictedHeaders = map[string]struct{}{
	http.CanonicalHeaderKey("Host"):                {},
	http.CanonicalHeaderKey("Accept-Encoding"):     {},
	http.CanonicalHeaderKey("Accept-Charset"):      {},
	http.CanonicalHeaderKey("Content-Encoding"):    {},
	http.CanonicalHeaderKey("Content-Length"):      {},
	http.CanonicalHeaderKey("Authorization"):       {}, // Settable via other fields.
	http.CanonicalHeaderKey("User-Agent"):          {}, // Preserve our client user-agent.
	http.CanonicalHeaderKey("Transfer-Encoding"):   {},
	http.CanonicalHeaderKey("Connection"):          {},
	http.CanonicalHeaderKey("Upgrade"):             {},
	http.CanonicalHeaderKey("Trailer"):             {},
	http.CanonicalHeaderKey("TE"):                  {},
	http.CanonicalHeaderKey("Proxy-Authorization"): {},
	http.CanonicalHeaderKey("Proxy-Authenticate"):  {},
	http.CanonicalHeaderKey("Cookie"):              {},
	http.CanonicalHeaderKey("Set-Cookie"):          {},
	http.CanonicalHeaderKey("Referer"):             {},
	http.CanonicalHeaderKey("Origin"):              {},
	http.CanonicalHeaderKey("X-Forwarded-For"):     {},
	http.CanonicalHeaderKey("X-Real-IP"):           {},
	http.CanonicalHeaderKey("Via"):                 {},
	http.CanonicalHeaderKey("Forwarded"):           {},
	http.CanonicalHeaderKey("Expect"):              {},
	http.CanonicalHeaderKey("Keep-Alive"):          {},
	http.CanonicalHeaderKey("Date"):                {},
	http.CanonicalHeaderKey("Max-Forwards"):        {},
}

// OmitRestrictedHeaders returns new headers with restricted custom headers omitted. The exact risk of allowing
// customization of these headers is not clear, but it is better to be safe at first pass. We can always loosen the
// restrictions later if we find that it is not a problem.
// Returns the new headers and a list of omitted headers.
func OmitRestrictedHeaders(headers map[string]string) (map[string]string, []string) {
	safeHeaders := make(map[string]string, len(headers))
	omitted := make([]string, 0)
	for k, v := range headers {
		if _, ok := restrictedHeaders[http.CanonicalHeaderKey(k)]; ok {
			omitted = append(omitted, k)
			continue
		}
		safeHeaders[k] = v // We keep the original case of the header, as it might have been intentional.
	}
	return safeHeaders, omitted
}
