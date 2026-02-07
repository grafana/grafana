package v1

import (
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const (
	Version       = schema.V1
	DefaultAPIURL = "https://webexapis.com/v1/messages"
)

// PLEASE do not touch these settings without taking a look at what we support as part of
// https://github.com/prometheus/alertmanager/blob/main/notify/webex/webex.go
// Currently, the Alerting team is unifying channels and (upstream) receivers - any discrepancy is detrimental to that.
type Config struct {
	Message string `json:"message,omitempty" yaml:"message,omitempty"`
	RoomID  string `json:"room_id,omitempty" yaml:"room_id,omitempty"`
	APIURL  string `json:"api_url,omitempty" yaml:"api_url,omitempty"`
	Token   string `json:"bot_token" yaml:"bot_token"`
}

// NewConfig is the constructor for the Webex notifier.
func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.APIURL == "" {
		settings.APIURL = DefaultAPIURL
	}

	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}

	settings.Token = decryptFn("bot_token", settings.Token)

	u, err := url.Parse(settings.APIURL)
	if err != nil {
		return Config{}, fmt.Errorf("invalid URL %q", settings.APIURL)
	}
	settings.APIURL = u.String()

	return settings, err
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "Cisco Webex API URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "https://api.ciscospark.com/v1/messages",
			Description:  "API endpoint at which we'll send webhooks to.",
			PropertyName: "api_url",
			Protected:    true,
		},
		{
			Label:        "Room ID",
			Description:  "The room ID to send messages to.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "GMtOWY0ZGJkNzMyMGFl",
			PropertyName: "room_id",
			Required:     true,
		},
		{
			Label:        "Bot Token",
			Description:  "Non-expiring access token of the bot that will post messages on our behalf.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  `GMtOWY0ZGJkNzMyMGFl-12535454-123213`,
			PropertyName: "bot_token",
			Secure:       true,
			Required:     true,
		},
		{
			Label:        "Notification Template",
			Description:  "Notification template to use. Markdown is supported.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  `{{ template "default.message" . }}`,
			PropertyName: "message",
		},
	},
}
