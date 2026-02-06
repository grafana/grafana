package v1

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type Config struct {
	SingleEmail bool
	Addresses   []string
	Message     string
	Subject     string
}

func NewConfig(jsonData json.RawMessage) (Config, error) {
	type emailSettingsRaw struct {
		SingleEmail bool   `json:"singleEmail,omitempty" yaml:"singleEmail,omitempty"`
		Addresses   string `json:"addresses,omitempty" yaml:"addresses,omitempty"`
		Message     string `json:"message,omitempty" yaml:"message,omitempty"`
		Subject     string `json:"subject,omitempty" yaml:"subject,omitempty"`
	}

	var settings emailSettingsRaw
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.Addresses == "" {
		return Config{}, errors.New("could not find addresses in settings")
	}
	// split addresses with a few different ways
	addresses := splitEmails(settings.Addresses)

	if settings.Subject == "" {
		settings.Subject = templates.DefaultMessageTitleEmbed
	}

	return Config{
		SingleEmail: settings.SingleEmail,
		Message:     settings.Message,
		Subject:     settings.Subject,
		Addresses:   addresses,
	}, nil
}

func splitEmails(emails string) []string {
	return strings.FieldsFunc(emails, func(r rune) bool {
		switch r {
		case ',', ';', '\n':
			return true
		}
		return false
	})
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "Single email",
			Description:  "Send a single email to all recipients",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "singleEmail",
		},
		{
			Label:        "Addresses",
			Description:  "You can enter multiple email addresses using a \";\", \"\\n\" or  \",\" separator",
			Element:      schema.ElementTypeTextArea,
			PropertyName: "addresses",
			Required:     true,
		},
		{ // New in 8.0.
			Label:        "Message",
			Description:  "Optional message. You can use templates to customize this field. Using a custom message will replace the default message",
			Element:      schema.ElementTypeTextArea,
			PropertyName: "message",
			Placeholder:  templates.DefaultMessageEmbed,
		},
		{ // New in 9.0.
			Label:        "Subject",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Optional subject. You can use templates to customize this field",
			PropertyName: "subject",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
	},
}
