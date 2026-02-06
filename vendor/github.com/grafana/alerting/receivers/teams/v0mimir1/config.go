package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.MSTeamsConfig

var Schema = schema.IntegrationSchemaVersion{
	TypeAlias: "msteams",
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
			Placeholder:  config.DefaultMSTeamsConfig.Title,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "title",
		},
		{
			Label:        "Summary",
			Description:  "Message summary template.",
			Placeholder:  config.DefaultMSTeamsConfig.Summary,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "summary",
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
