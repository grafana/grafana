package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.OpsGenieConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:    Version,
	CanCreate:  false,
	Deprecated: true,
	Options: []schema.Field{
		{
			Label:        "API key",
			Description:  "The API key to use when talking to the OpsGenie API.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_key",
			Secure:       true,
			Required:     true,
		},
		{
			Label:        "API URL",
			Description:  "The host to send OpsGenie API requests to.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
			Required:     true,
		},
		{
			Label:        "Message",
			Description:  "Alert text limited to 130 characters.",
			Placeholder:  config.DefaultOpsGenieConfig.Message,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message",
		},
		{
			Label:        "Description",
			Description:  "A description of the incident.",
			Placeholder:  config.DefaultOpsGenieConfig.Description,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "description",
		},
		{
			Label:        "Source",
			Description:  "A backlink to the sender of the notification.",
			Placeholder:  config.DefaultOpsGenieConfig.Source,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "source",
		},
		{
			Label:        "Details",
			Description:  "A set of arbitrary key/value pairs that provide further detail about the incident.",
			Element:      schema.ElementTypeKeyValueMap,
			PropertyName: "details",
		},
		{
			Label:        "Entity",
			Description:  "Optional field that can be used to specify which domain alert is related to.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "entity",
		},
		{
			Label:        "Actions",
			Description:  "Comma separated list of actions that will be available for the alert.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "actions",
		},
		{
			Label:        "Tags",
			Description:  "Comma separated list of tags attached to the notifications.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "tags",
		},
		{
			Label:        "Note",
			Description:  "Additional alert note.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "note",
		},
		{
			Label:        "Priority",
			Description:  "Priority level of alert. Possible values are P1, P2, P3, P4, and P5.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "priority",
		},
		{
			Label:        "Update Alerts",
			Description:  "Whether to update message and description of the alert in OpsGenie if it already exists. By default, the alert is never updated in OpsGenie, the new message only appears in activity log.",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "update_alerts",
		},
		{
			Label:        "Responders",
			Description:  "List of responders responsible for notifications.",
			Element:      schema.ElementSubformArray,
			PropertyName: "responders",
			SubformOptions: []schema.Field{
				{
					Label:        "Type",
					Description:  "\"team\", \"user\", \"escalation\" or schedule\".",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "type",
				},
				{
					Label:        "ID",
					Description:  "Exactly one of these fields should be defined.",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "id",
				},
				{
					Label:        "Name",
					Description:  "Exactly one of these fields should be defined.",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "name",
				},
				{
					Label:        "Username",
					Description:  "Exactly one of these fields should be defined.",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "username",
				},
			},
		},
		schema.V0HttpConfigOption(),
	},
}
