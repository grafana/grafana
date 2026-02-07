package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config config.DiscordConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "Webhook URL",
			Placeholder:  "Discord webhook URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "webhook_url",
			Required:     true,
			Secure:       true,
		},
		{
			Label:        "Title",
			Description:  "Templated title of the message",
			Placeholder:  config.DefaultDiscordConfig.Title,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "title",
		},
		{
			Label:        "Message Content",
			Description:  "Mention a group using @ or a user using <@ID> when notifying in a channel",
			Placeholder:  config.DefaultDiscordConfig.Message,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message",
		},
		schema.V0HttpConfigOption(),
	},
}
