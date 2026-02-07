package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.VictorOpsConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "API key",
			Description:  "The API key to use when talking to the VictorOps API.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_key",
			Secure:       true,
		},
		{
			Label:        "API URL",
			Description:  "The VictorOps API URL.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
		},
		{
			Label:        "Routing key",
			Description:  "A key used to map the alert to a team.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "routing_key",
			Required:     true,
		},
		{
			Label:        "Message type",
			Description:  "Describes the behavior of the alert (CRITICAL, WARNING, INFO).",
			Placeholder:  config.DefaultVictorOpsConfig.MessageType,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message_type",
		},
		{
			Label:        "Entity display name",
			Description:  "Contains summary of the alerted problem.",
			Placeholder:  config.DefaultVictorOpsConfig.EntityDisplayName,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "entity_display_name",
		},
		{
			Label:        "State message",
			Description:  "Contains long explanation of the alerted problem.",
			Placeholder:  config.DefaultVictorOpsConfig.StateMessage,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "state_message",
		},
		{
			Label:        "Monitoring tool",
			Description:  "The monitoring tool the state message is from.",
			Placeholder:  config.DefaultVictorOpsConfig.MonitoringTool,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "monitoring_tool",
		},
		{
			Label:        "Custom Fields",
			Description:  "A set of arbitrary key/value pairs that provide further detail about the alert.",
			Element:      schema.ElementTypeKeyValueMap,
			PropertyName: "custom_fields",
		},
		schema.V0HttpConfigOption(),
	},
}
