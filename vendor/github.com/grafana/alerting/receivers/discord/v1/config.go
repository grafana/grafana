package v1

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type Config struct {
	Title              string `json:"title,omitempty" yaml:"title,omitempty"`
	Message            string `json:"message,omitempty" yaml:"message,omitempty"`
	AvatarURL          string `json:"avatar_url,omitempty" yaml:"avatar_url,omitempty"`
	WebhookURL         string `json:"url,omitempty" yaml:"url,omitempty"`
	UseDiscordUsername bool   `json:"use_discord_username,omitempty" yaml:"use_discord_username,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	settings.WebhookURL = decryptFn("url", settings.WebhookURL)
	if settings.WebhookURL == "" {
		return Config{}, errors.New("could not find webhook url property in settings")
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}
	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "Title",
			Description:  "Templated title of the message",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Placeholder:  templates.DefaultMessageTitleEmbed,
			PropertyName: "title",
		},
		{
			Label:        "Message Content",
			Description:  "Mention a group using @ or a user using <@ID> when notifying in a channel",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Placeholder:  templates.DefaultMessageEmbed,
			PropertyName: "message",
		},
		{
			Label:        "Webhook URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "Discord webhook URL",
			PropertyName: "url",
			Required:     true,
			Secure:       true,
			Protected:    true,
		},
		{
			Label:        "Avatar URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "avatar_url",
		},
		{
			Label:        "Use Discord's Webhook Username",
			Description:  "Use the username configured in Discord's webhook settings. Otherwise, the username will be 'Grafana'",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "use_discord_username",
		},
	},
}
