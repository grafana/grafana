package openapi3

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
)

// SecurityScheme is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#security-scheme-object
type SecurityScheme struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Type             string      `json:"type,omitempty" yaml:"type,omitempty"`
	Description      string      `json:"description,omitempty" yaml:"description,omitempty"`
	Name             string      `json:"name,omitempty" yaml:"name,omitempty"`
	In               string      `json:"in,omitempty" yaml:"in,omitempty"`
	Scheme           string      `json:"scheme,omitempty" yaml:"scheme,omitempty"`
	BearerFormat     string      `json:"bearerFormat,omitempty" yaml:"bearerFormat,omitempty"`
	Flows            *OAuthFlows `json:"flows,omitempty" yaml:"flows,omitempty"`
	OpenIdConnectUrl string      `json:"openIdConnectUrl,omitempty" yaml:"openIdConnectUrl,omitempty"`
}

func NewSecurityScheme() *SecurityScheme {
	return &SecurityScheme{}
}

func NewCSRFSecurityScheme() *SecurityScheme {
	return &SecurityScheme{
		Type: "apiKey",
		In:   "header",
		Name: "X-XSRF-TOKEN",
	}
}

func NewOIDCSecurityScheme(oidcUrl string) *SecurityScheme {
	return &SecurityScheme{
		Type:             "openIdConnect",
		OpenIdConnectUrl: oidcUrl,
	}
}

func NewJWTSecurityScheme() *SecurityScheme {
	return &SecurityScheme{
		Type:         "http",
		Scheme:       "bearer",
		BearerFormat: "JWT",
	}
}

// MarshalJSON returns the JSON encoding of SecurityScheme.
func (ss SecurityScheme) MarshalJSON() ([]byte, error) {
	x, err := ss.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of SecurityScheme.
func (ss SecurityScheme) MarshalYAML() (any, error) {
	m := make(map[string]any, 8+len(ss.Extensions))
	for k, v := range ss.Extensions {
		m[k] = v
	}
	if x := ss.Type; x != "" {
		m["type"] = x
	}
	if x := ss.Description; x != "" {
		m["description"] = x
	}
	if x := ss.Name; x != "" {
		m["name"] = x
	}
	if x := ss.In; x != "" {
		m["in"] = x
	}
	if x := ss.Scheme; x != "" {
		m["scheme"] = x
	}
	if x := ss.BearerFormat; x != "" {
		m["bearerFormat"] = x
	}
	if x := ss.Flows; x != nil {
		m["flows"] = x
	}
	if x := ss.OpenIdConnectUrl; x != "" {
		m["openIdConnectUrl"] = x
	}
	return m, nil
}

// UnmarshalJSON sets SecurityScheme to a copy of data.
func (ss *SecurityScheme) UnmarshalJSON(data []byte) error {
	type SecuritySchemeBis SecurityScheme
	var x SecuritySchemeBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "type")
	delete(x.Extensions, "description")
	delete(x.Extensions, "name")
	delete(x.Extensions, "in")
	delete(x.Extensions, "scheme")
	delete(x.Extensions, "bearerFormat")
	delete(x.Extensions, "flows")
	delete(x.Extensions, "openIdConnectUrl")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*ss = SecurityScheme(x)
	return nil
}

func (ss *SecurityScheme) WithType(value string) *SecurityScheme {
	ss.Type = value
	return ss
}

func (ss *SecurityScheme) WithDescription(value string) *SecurityScheme {
	ss.Description = value
	return ss
}

func (ss *SecurityScheme) WithName(value string) *SecurityScheme {
	ss.Name = value
	return ss
}

func (ss *SecurityScheme) WithIn(value string) *SecurityScheme {
	ss.In = value
	return ss
}

func (ss *SecurityScheme) WithScheme(value string) *SecurityScheme {
	ss.Scheme = value
	return ss
}

func (ss *SecurityScheme) WithBearerFormat(value string) *SecurityScheme {
	ss.BearerFormat = value
	return ss
}

// Validate returns an error if SecurityScheme does not comply with the OpenAPI spec.
func (ss *SecurityScheme) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	hasIn := false
	hasBearerFormat := false
	hasFlow := false
	switch ss.Type {
	case "apiKey":
		hasIn = true
	case "http":
		scheme := ss.Scheme
		switch scheme {
		case "bearer":
			hasBearerFormat = true
		case "basic", "negotiate", "digest":
		default:
			return fmt.Errorf("security scheme of type 'http' has invalid 'scheme' value %q", scheme)
		}
	case "oauth2":
		hasFlow = true
	case "openIdConnect":
		if ss.OpenIdConnectUrl == "" {
			return fmt.Errorf("no OIDC URL found for openIdConnect security scheme %q", ss.Name)
		}
	default:
		return fmt.Errorf("security scheme 'type' can't be %q", ss.Type)
	}

	// Validate "in" and "name"
	if hasIn {
		switch ss.In {
		case "query", "header", "cookie":
		default:
			return fmt.Errorf("security scheme of type 'apiKey' should have 'in'. It can be 'query', 'header' or 'cookie', not %q", ss.In)
		}
		if ss.Name == "" {
			return errors.New("security scheme of type 'apiKey' should have 'name'")
		}
	} else if len(ss.In) > 0 {
		return fmt.Errorf("security scheme of type %q can't have 'in'", ss.Type)
	} else if len(ss.Name) > 0 {
		return fmt.Errorf("security scheme of type %q can't have 'name'", ss.Type)
	}

	// Validate "format"
	// "bearerFormat" is an arbitrary string so we only check if the scheme supports it
	if !hasBearerFormat && len(ss.BearerFormat) > 0 {
		return fmt.Errorf("security scheme of type %q can't have 'bearerFormat'", ss.Type)
	}

	// Validate "flow"
	if hasFlow {
		flow := ss.Flows
		if flow == nil {
			return fmt.Errorf("security scheme of type %q should have 'flows'", ss.Type)
		}
		if err := flow.Validate(ctx); err != nil {
			return fmt.Errorf("security scheme 'flow' is invalid: %w", err)
		}
	} else if ss.Flows != nil {
		return fmt.Errorf("security scheme of type %q can't have 'flows'", ss.Type)
	}

	return validateExtensions(ctx, ss.Extensions)
}

// OAuthFlows is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#oauth-flows-object
type OAuthFlows struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Implicit          *OAuthFlow `json:"implicit,omitempty" yaml:"implicit,omitempty"`
	Password          *OAuthFlow `json:"password,omitempty" yaml:"password,omitempty"`
	ClientCredentials *OAuthFlow `json:"clientCredentials,omitempty" yaml:"clientCredentials,omitempty"`
	AuthorizationCode *OAuthFlow `json:"authorizationCode,omitempty" yaml:"authorizationCode,omitempty"`
}

type oAuthFlowType int

const (
	oAuthFlowTypeImplicit oAuthFlowType = iota
	oAuthFlowTypePassword
	oAuthFlowTypeClientCredentials
	oAuthFlowAuthorizationCode
)

// MarshalJSON returns the JSON encoding of OAuthFlows.
func (flows OAuthFlows) MarshalJSON() ([]byte, error) {
	x, err := flows.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of OAuthFlows.
func (flows OAuthFlows) MarshalYAML() (any, error) {
	m := make(map[string]any, 4+len(flows.Extensions))
	for k, v := range flows.Extensions {
		m[k] = v
	}
	if x := flows.Implicit; x != nil {
		m["implicit"] = x
	}
	if x := flows.Password; x != nil {
		m["password"] = x
	}
	if x := flows.ClientCredentials; x != nil {
		m["clientCredentials"] = x
	}
	if x := flows.AuthorizationCode; x != nil {
		m["authorizationCode"] = x
	}
	return m, nil
}

// UnmarshalJSON sets OAuthFlows to a copy of data.
func (flows *OAuthFlows) UnmarshalJSON(data []byte) error {
	type OAuthFlowsBis OAuthFlows
	var x OAuthFlowsBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "implicit")
	delete(x.Extensions, "password")
	delete(x.Extensions, "clientCredentials")
	delete(x.Extensions, "authorizationCode")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*flows = OAuthFlows(x)
	return nil
}

// Validate returns an error if OAuthFlows does not comply with the OpenAPI spec.
func (flows *OAuthFlows) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if v := flows.Implicit; v != nil {
		if err := v.validate(ctx, oAuthFlowTypeImplicit, opts...); err != nil {
			return fmt.Errorf("the OAuth flow 'implicit' is invalid: %w", err)
		}
	}

	if v := flows.Password; v != nil {
		if err := v.validate(ctx, oAuthFlowTypePassword, opts...); err != nil {
			return fmt.Errorf("the OAuth flow 'password' is invalid: %w", err)
		}
	}

	if v := flows.ClientCredentials; v != nil {
		if err := v.validate(ctx, oAuthFlowTypeClientCredentials, opts...); err != nil {
			return fmt.Errorf("the OAuth flow 'clientCredentials' is invalid: %w", err)
		}
	}

	if v := flows.AuthorizationCode; v != nil {
		if err := v.validate(ctx, oAuthFlowAuthorizationCode, opts...); err != nil {
			return fmt.Errorf("the OAuth flow 'authorizationCode' is invalid: %w", err)
		}
	}

	return validateExtensions(ctx, flows.Extensions)
}

// OAuthFlow is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#oauth-flow-object
type OAuthFlow struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	AuthorizationURL string    `json:"authorizationUrl,omitempty" yaml:"authorizationUrl,omitempty"`
	TokenURL         string    `json:"tokenUrl,omitempty" yaml:"tokenUrl,omitempty"`
	RefreshURL       string    `json:"refreshUrl,omitempty" yaml:"refreshUrl,omitempty"`
	Scopes           StringMap `json:"scopes" yaml:"scopes"` // required
}

// MarshalJSON returns the JSON encoding of OAuthFlow.
func (flow OAuthFlow) MarshalJSON() ([]byte, error) {
	x, err := flow.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of OAuthFlow.
func (flow OAuthFlow) MarshalYAML() (any, error) {
	m := make(map[string]any, 4+len(flow.Extensions))
	for k, v := range flow.Extensions {
		m[k] = v
	}
	if x := flow.AuthorizationURL; x != "" {
		m["authorizationUrl"] = x
	}
	if x := flow.TokenURL; x != "" {
		m["tokenUrl"] = x
	}
	if x := flow.RefreshURL; x != "" {
		m["refreshUrl"] = x
	}
	m["scopes"] = flow.Scopes
	return m, nil
}

// UnmarshalJSON sets OAuthFlow to a copy of data.
func (flow *OAuthFlow) UnmarshalJSON(data []byte) error {
	type OAuthFlowBis OAuthFlow
	var x OAuthFlowBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, originKey)
	delete(x.Extensions, "authorizationUrl")
	delete(x.Extensions, "tokenUrl")
	delete(x.Extensions, "refreshUrl")
	delete(x.Extensions, "scopes")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*flow = OAuthFlow(x)
	return nil
}

// Validate returns an error if OAuthFlows does not comply with the OpenAPI spec.
func (flow *OAuthFlow) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if v := flow.RefreshURL; v != "" {
		if _, err := url.Parse(v); err != nil {
			return fmt.Errorf("field 'refreshUrl' is invalid: %w", err)
		}
	}

	if flow.Scopes == nil {
		return errors.New("field 'scopes' is missing")
	}

	return validateExtensions(ctx, flow.Extensions)
}

func (flow *OAuthFlow) validate(ctx context.Context, typ oAuthFlowType, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	typeIn := func(types ...oAuthFlowType) bool {
		for _, ty := range types {
			if ty == typ {
				return true
			}
		}
		return false
	}

	if in := typeIn(oAuthFlowTypeImplicit, oAuthFlowAuthorizationCode); true {
		switch {
		case flow.AuthorizationURL == "" && in:
			return errors.New("field 'authorizationUrl' is empty or missing")
		case flow.AuthorizationURL != "" && !in:
			return errors.New("field 'authorizationUrl' should not be set")
		case flow.AuthorizationURL != "":
			if _, err := url.Parse(flow.AuthorizationURL); err != nil {
				return fmt.Errorf("field 'authorizationUrl' is invalid: %w", err)
			}
		}
	}

	if in := typeIn(oAuthFlowTypePassword, oAuthFlowTypeClientCredentials, oAuthFlowAuthorizationCode); true {
		switch {
		case flow.TokenURL == "" && in:
			return errors.New("field 'tokenUrl' is empty or missing")
		case flow.TokenURL != "" && !in:
			return errors.New("field 'tokenUrl' should not be set")
		case flow.TokenURL != "":
			if _, err := url.Parse(flow.TokenURL); err != nil {
				return fmt.Errorf("field 'tokenUrl' is invalid: %w", err)
			}
		}
	}

	return flow.Validate(ctx, opts...)
}

// UnmarshalJSON sets SecuritySchemes to a copy of data.
func (securitySchemes *SecuritySchemes) UnmarshalJSON(data []byte) (err error) {
	*securitySchemes, _, err = unmarshalStringMapP[SecuritySchemeRef](data)
	return
}
