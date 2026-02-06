package v0mimir2

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir2

type Config = config.MSTeamsV2Config

var Schema = schema.IntegrationSchemaVersion{
	TypeAlias: "msteamsv2",
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "Webhook URL",
			Description:  "The incoming webhook URL.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "webhook_url",
			Secure:       true,
			Required:     true,
		},
		{
			Label:        "Title",
			Description:  "Message title template.",
			Placeholder:  config.DefaultMSTeamsV2Config.Title,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "title",
		},
		{
			Label:        "Text",
			Description:  "Message body template.",
			Placeholder:  config.DefaultMSTeamsConfig.Text,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "text",
		},
		schema.V0HttpConfigOption(),
	},
}
