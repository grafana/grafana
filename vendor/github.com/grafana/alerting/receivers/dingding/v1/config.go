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
	URL         string `json:"url,omitempty" yaml:"url,omitempty"`
	MessageType string `json:"msgType,omitempty" yaml:"msgType,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Message     string `json:"message,omitempty" yaml:"message,omitempty"`
}

const defaultDingdingMsgType = "link"

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	settings.URL = decryptFn("url", settings.URL)
	if settings.URL == "" {
		return Config{}, errors.New("could not find url property in settings")
	}
	if settings.MessageType == "" {
		settings.MessageType = defaultDingdingMsgType
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
			Label:        "URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx",
			PropertyName: "url",
			Required:     true,
			Secure:       true,
			Protected:    true,
		},
		{
			Label:        "Message Type",
			Element:      schema.ElementTypeSelect,
			PropertyName: "msgType",
			SelectOptions: []schema.SelectOption{
				{
					Value: "link",
					Label: "Link"},
				{
					Value: "actionCard",
					Label: "ActionCard",
				},
			},
		},
		{ // New in 9.3.
			Label:        "Title",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Description:  "Templated title of the message",
			Placeholder:  templates.DefaultMessageTitleEmbed,
			PropertyName: "title",
		},
		{ // New in 8.0.
			Label:        "Message",
			Element:      schema.ElementTypeTextArea,
			Description:  "Custom DingDing message. You can use template variables.",
			Placeholder:  templates.DefaultMessageEmbed,
			PropertyName: "message",
		},
	},
}
