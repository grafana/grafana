package v1

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type Config struct {
	GatewayID   string `json:"gateway_id,omitempty" yaml:"gateway_id,omitempty"`
	RecipientID string `json:"recipient_id,omitempty" yaml:"recipient_id,omitempty"`
	APISecret   string `json:"api_secret,omitempty" yaml:"api_secret,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	// GatewayID validaiton
	if settings.GatewayID == "" {
		return settings, errors.New("could not find Threema Gateway ID in settings")
	}
	if !strings.HasPrefix(settings.GatewayID, "*") {
		return settings, errors.New("invalid Threema Gateway ID: Must start with a *")
	}
	if len(settings.GatewayID) != 8 {
		return settings, errors.New("invalid Threema Gateway ID: Must be 8 characters long")
	}

	// RecipientID validation
	if settings.RecipientID == "" {
		return settings, errors.New("could not find Threema Recipient ID in settings")
	}
	if len(settings.RecipientID) != 8 {
		return settings, errors.New("invalid Threema Recipient ID: Must be 8 characters long")
	}
	settings.APISecret = decryptFn("api_secret", settings.APISecret)
	if settings.APISecret == "" {
		return settings, errors.New("could not find Threema API secret in settings")
	}

	if settings.Description == "" {
		settings.Description = templates.DefaultMessageEmbed
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}

	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:          "Gateway ID",
			Element:        schema.ElementTypeInput,
			InputType:      schema.InputTypeText,
			Placeholder:    "*3MAGWID",
			Description:    "Your 8 character Threema Gateway Basic ID (starting with a *).",
			PropertyName:   "gateway_id",
			Required:       true,
			ValidationRule: "\\*[0-9A-Z]{7}",
		},
		{
			Label:          "Recipient ID",
			Element:        schema.ElementTypeInput,
			InputType:      schema.InputTypeText,
			Placeholder:    "YOUR3MID",
			Description:    "The 8 character Threema ID that should receive the alerts.",
			PropertyName:   "recipient_id",
			Required:       true,
			ValidationRule: "[0-9A-Z]{8}",
		},
		{
			Label:        "API Secret",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Your Threema Gateway API secret.",
			PropertyName: "api_secret",
			Required:     true,
			Secure:       true,
		},
		{ // New in 9.3
			Label:        "Title",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated title of the message.",
			PropertyName: "title",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
		{ // New in 9.3
			Label:        "Description",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated description of the message.",
			PropertyName: "description",
			Placeholder:  templates.DefaultMessageEmbed,
		},
	},
}
