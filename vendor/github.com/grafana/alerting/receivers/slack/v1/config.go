package v1

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type Config struct {
	EndpointURL    string                          `json:"endpointUrl,omitempty" yaml:"endpointUrl,omitempty"`
	URL            string                          `json:"url,omitempty" yaml:"url,omitempty"`
	Token          string                          `json:"token,omitempty" yaml:"token,omitempty"`
	Recipient      string                          `json:"recipient,omitempty" yaml:"recipient,omitempty"`
	Text           string                          `json:"text,omitempty" yaml:"text,omitempty"`
	Title          string                          `json:"title,omitempty" yaml:"title,omitempty"`
	Username       string                          `json:"username,omitempty" yaml:"username,omitempty"`
	IconEmoji      string                          `json:"icon_emoji,omitempty" yaml:"icon_emoji,omitempty"`
	IconURL        string                          `json:"icon_url,omitempty" yaml:"icon_url,omitempty"`
	MentionChannel string                          `json:"mentionChannel,omitempty" yaml:"mentionChannel,omitempty"`
	MentionUsers   receivers.CommaSeparatedStrings `json:"mentionUsers,omitempty" yaml:"mentionUsers,omitempty"`
	MentionGroups  receivers.CommaSeparatedStrings `json:"mentionGroups,omitempty" yaml:"mentionGroups,omitempty"`
	Color          string                          `json:"color,omitempty" yaml:"color,omitempty"`
	Footer         string                          `json:"footer,omitempty" yaml:"footer,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.EndpointURL == "" {
		settings.EndpointURL = APIURL
	}
	slackURL := decryptFn("url", settings.URL)
	if slackURL == "" {
		slackURL = settings.EndpointURL
	}

	apiURL, err := url.Parse(slackURL)
	if err != nil {
		return Config{}, fmt.Errorf("invalid URL %q", slackURL)
	}
	settings.URL = apiURL.String()

	settings.Recipient = strings.TrimSpace(settings.Recipient)
	if settings.Recipient == "" && settings.URL == APIURL {
		return Config{}, errors.New("recipient must be specified when using the Slack chat API")
	}
	if settings.MentionChannel != "" && settings.MentionChannel != "here" && settings.MentionChannel != "channel" {
		return Config{}, fmt.Errorf("invalid value for mentionChannel: %q", settings.MentionChannel)
	}
	settings.Token = decryptFn("token", settings.Token)
	if settings.Token == "" && settings.URL == APIURL {
		return Config{}, errors.New("token must be specified when using the Slack chat API")
	}
	if settings.Username == "" {
		settings.Username = "Grafana"
	}
	if settings.Text == "" {
		settings.Text = templates.DefaultMessageEmbed
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if settings.Color == "" {
		settings.Color = templates.DefaultMessageColor
	}
	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "Recipient",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Specify channel, private group, or IM channel (can be an encoded ID or a name) - required unless you provide a webhook",
			PropertyName: "recipient",
			Required:     true,
			DependsOn:    "url",
		},
		// Logically, this field should be required when not using a webhook, since the Slack API needs a token.
		// However, since the UI doesn't allow to say that a field is required or not depending on another field,
		// we've gone with the compromise of making this field optional and instead return a validation error
		// if it's necessary and missing.
		{
			Label:        "Token",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Provide a Slack API token (starts with \"xoxb\") - required unless you provide a webhook",
			PropertyName: "token",
			Secure:       true,
			Required:     true,
			DependsOn:    "url",
		},
		{
			Label:        "Username",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Set the username for the bot's message",
			PropertyName: "username",
		},
		{
			Label:        "Icon emoji",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Provide an emoji to use as the icon for the bot's message. Overrides the icon URL.",
			PropertyName: "icon_emoji",
		},
		{
			Label:        "Icon URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Provide a URL to an image to use as the icon for the bot's message",
			PropertyName: "icon_url",
		},
		{
			Label:        "Mention Users",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Mention one or more users (comma separated) when notifying in a channel, by ID (you can copy this from the user's Slack profile)",
			PropertyName: "mentionUsers",
		},
		{
			Label:        "Mention Groups",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Mention one or more groups (comma separated) when notifying in a channel (you can copy this from the group's Slack profile URL)",
			PropertyName: "mentionGroups",
		},
		{
			Label:   "Mention Channel",
			Element: schema.ElementTypeSelect,
			SelectOptions: []schema.SelectOption{
				{
					Value: "",
					Label: "Disabled",
				},
				{
					Value: "here",
					Label: "Every active channel member",
				},
				{
					Value: "channel",
					Label: "Every channel member",
				},
			},
			Description:  "Mention whole channel or just active members when notifying",
			PropertyName: "mentionChannel",
		},
		{
			Label:        "Webhook URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Optionally provide a Slack incoming webhook URL for sending messages, in this case the token isn't necessary",
			Placeholder:  "Slack incoming webhook URL",
			PropertyName: "url",
			Secure:       true,
			Required:     true,
			DependsOn:    "token",
			Protected:    true,
		},
		{ // New in 8.4.
			Label:        "Endpoint URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Optionally provide a custom Slack message API endpoint for non-webhook requests, default is https://slack.com/api/chat.postMessage",
			Placeholder:  "Slack endpoint url",
			PropertyName: "endpointUrl",
			Protected:    true,
		},
		{
			Label:        "Color",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Templated color of the slack message",
			Placeholder:  templates.DefaultMessageColor,
			PropertyName: "color",
		},
		{ // New in 8.0.
			Label:        "Title",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Templated title of the slack message",
			PropertyName: "title",
			Placeholder:  `{{ template "slack.default.title" . }}`,
		},
		{ // New in 8.0.
			Label:        "Text Body",
			Element:      schema.ElementTypeTextArea,
			Description:  "Body of the slack message",
			PropertyName: "text",
			Placeholder:  `{{ template "slack.default.text" . }}`,
		},
		{
			Label:        "Footer",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Templated footer of the slack message",
			PropertyName: "footer",
			Placeholder:  `{{ template "slack.default.footer" . }}`,
		},
	},
}
