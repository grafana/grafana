package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.WebhookConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "URL",
			Description:  "The endpoint to send HTTP POST requests to.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "url",
			Secure:       true,
			Required:     true,
		},
		{
			Label:          "Max alerts",
			Description:    "The maximum number of alerts to include in a single webhook message. Alerts above this threshold are truncated. When leaving this at its default value of 0, all alerts are included.",
			Element:        schema.ElementTypeInput,
			InputType:      "number",
			PropertyName:   "max_alerts",
			ValidationRule: "(^\\d+$|^$)",
		},
		{
			Label:        "Timeout",
			Description:  "The maximum time to wait for a webhook request to complete, before failing the request and allowing it to be retried. The default value of 0s indicates that no timeout should be applied. NOTE: This will have no effect if set higher than the group_interval.",
			Placeholder:  "Use duration format, for example: 1.2s, 100ms",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "timeout",
		},
		schema.V0HttpConfigOption(),
	},
}
