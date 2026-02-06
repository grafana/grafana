package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.PushoverConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "User key",
			Description:  "The recipient user’s user key.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "user_key",
			Required:     true,
			Secure:       true,
		},
		{
			Label:        "Token",
			Description:  "Your registered application’s API token, see https://pushover.net/app",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "token",
			Required:     true,
			Secure:       true,
		},
		{
			Label:        "Title",
			Description:  "Notification title.",
			Placeholder:  config.DefaultPushoverConfig.Title,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "title",
		},
		{
			Label:        "Message",
			Description:  "Notification message.",
			Placeholder:  config.DefaultPushoverConfig.Message,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message",
		},
		{
			Label:        "URL",
			Description:  "A supplementary URL shown alongside the message.",
			Placeholder:  config.DefaultPushoverConfig.URL,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "url",
		},
		{
			Label:        "URL Title",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "url_title",
		},
		{
			Label:        "Device",
			Description:  "Optional device to send notification to, see https://pushover.net/api#device",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "device",
		},
		{
			Label:        "Sound",
			Description:  "Optional sound to use for notification, see https://pushover.net/api#sound",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "sound",
		},
		{
			Label:        "Priority",
			Description:  "Priority, see https://pushover.net/api#priority",
			Placeholder:  config.DefaultPushoverConfig.Priority,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "priority",
		},
		{
			Label:        "Retry",
			Description:  "How often the Pushover servers will send the same notification to the user. Must be at least 30 seconds.",
			Placeholder:  "1m",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "retry",
		},
		{
			Label:        "Expire",
			Description:  "How long your notification will continue to be retried for, unless the user acknowledges the notification.",
			Placeholder:  "1h",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "expire",
		},
		{
			Label:        "TTL",
			Description:  "The number of seconds before a message expires and is deleted automatically. Examples: 10s, 5m30s, 8h.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "ttl",
		},
		{
			Label:        "HTML",
			Description:  "Enables HTML formatting of the message.",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "html",
		},
		schema.V0HttpConfigOption(),
	},
}
