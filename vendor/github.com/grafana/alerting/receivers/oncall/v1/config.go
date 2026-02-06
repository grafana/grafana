package v1

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type Config struct {
	URL        string
	HTTPMethod string
	MaxAlerts  int
	// Authorization Header.
	AuthorizationScheme      string
	AuthorizationCredentials string
	// HTTP Basic Authentication.
	User     string
	Password string

	Title   string
	Message string
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
	settings.Title = rawSettings.Title
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	settings.Message = rawSettings.Message
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}
	return settings, err
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "url",
			Required:     true,
			Protected:    true,
		},
		{
			Label:   "HTTP Method",
			Element: schema.ElementTypeSelect,
			SelectOptions: []schema.SelectOption{
				{
					Value: "POST",
					Label: "POST",
				},
				{
					Value: "PUT",
					Label: "PUT",
				},
			},
			PropertyName: "httpMethod",
		},
		{
			Label:        "HTTP Basic Authentication - Username",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "username",
		},
		{
			Label:        "HTTP Basic Authentication - Password",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypePassword,
			PropertyName: "password",
			Secure:       true,
		},
		{ // New in 9.1
			Label:        "Authorization Header - Scheme",
			Description:  "Optionally provide a scheme for the Authorization Request Header. Default is Bearer.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "authorization_scheme",
			Placeholder:  "Bearer",
		},
		{ // New in 9.1
			Label:        "Authorization Header - Credentials",
			Description:  "Credentials for the Authorization Request header. Only one of HTTP Basic Authentication or Authorization Request Header can be set.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "authorization_credentials",
			Secure:       true,
		},
		{ // New in 8.0. TODO: How to enforce only numbers?
			Label:        "Max Alerts",
			Description:  "Max alerts to include in a notification. Remaining alerts in the same batch will be ignored above this number. 0 means no limit.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "maxAlerts",
		},
		{ // New in 9.3.
			Label:        "Title",
			Description:  "Templated title of the message.",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			PropertyName: "title",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
		{ // New in 9.3.
			Label:        "Message",
			Description:  "Custom message. You can use template variables.",
			Element:      schema.ElementTypeTextArea,
			PropertyName: "message",
			Placeholder:  templates.DefaultMessageEmbed,
		},
	},
}
