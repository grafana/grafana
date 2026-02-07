package v1

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const (
	Version = schema.V1
	// DefaultMessageType - Victorops uses "CRITICAL" string to indicate "Alerting" state
	DefaultMessageType = "CRITICAL"
)

type Config struct {
	URL         string `json:"url,omitempty" yaml:"url,omitempty"`
	MessageType string `json:"messageType,omitempty" yaml:"messageType,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	settings.URL = decryptFn("url", settings.URL)
	if settings.URL == "" {
		return settings, errors.New("could not find victorops url property in settings")
	}
	if settings.MessageType == "" {
		settings.MessageType = DefaultMessageType
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if settings.Description == "" {
		settings.Description = templates.DefaultMessageEmbed
	}
	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "VictorOps url",
			PropertyName: "url",
			Required:     true,
			Secure:       true,
			Protected:    true,
		},
		{ // New in 8.0.
			Label:        "Message Type",
			Element:      schema.ElementTypeSelect,
			PropertyName: "messageType",
			SelectOptions: []schema.SelectOption{
				{
					Value: "CRITICAL",
					Label: "CRITICAL"},
				{
					Value: "WARNING",
					Label: "WARNING",
				},
			},
		},
		{ // New in 9.3.
			Label:        "Title",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated title to display",
			PropertyName: "title",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
		{ // New in 9.3.
			Label:        "Description",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated description of the message",
			PropertyName: "description",
			Placeholder:  templates.DefaultMessageEmbed,
		},
	},
}
