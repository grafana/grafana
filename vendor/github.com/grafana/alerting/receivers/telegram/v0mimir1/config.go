package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.TelegramConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "API URL",
			Description:  "The Telegram API URL",
			Placeholder:  "https://api.telegram.org",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
		},
		{
			Label:        "Bot token",
			Description:  "Telegram bot token",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "token",
			Required:     true,
			Secure:       true,
		},
		{
			Label:        "Chat ID",
			Description:  "ID of the chat where to send the messages",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "chat_id",
			Required:     true,
		},
		{
			Label:        "Message",
			Description:  "Message template",
			Placeholder:  config.DefaultTelegramConfig.Message,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message",
		},
		{
			Label:        "Disable notifications",
			Description:  "Disable telegram notifications",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "disable_notifications",
		},
		{
			Label:        "Parse mode",
			Description:  "Parse mode for telegram message",
			Element:      schema.ElementTypeSelect,
			PropertyName: "parse_mode",
			SelectOptions: []schema.SelectOption{
				{Value: "", Label: "None"},
				{Value: "MarkdownV2", Label: "MarkdownV2"},
				{Value: "Markdown", Label: "Markdown"},
				{Value: "HTML", Label: "HTML"},
			},
		},
		schema.V0HttpConfigOption(),
	},
}
