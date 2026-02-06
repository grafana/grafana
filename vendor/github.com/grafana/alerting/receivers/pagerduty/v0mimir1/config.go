package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.PagerdutyConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "URL",
			Description:  "The URL to send API requests to",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "url",
			Required:     true,
		},
		{
			Label:        "Routing key",
			Description:  "The PagerDuty integration key (when using PagerDuty integration type `Events API v2`)",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "routing_key",
			Secure:       true,
			Required:     true,
		},
		{
			Label:        "Service key",
			Description:  "The PagerDuty integration key (when using PagerDuty integration type `Prometheus`).",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "service_key",
			Secure:       true,
			Required:     true,
		},
		{
			Label:        "Client",
			Description:  "The client identification of the Alertmanager.",
			Placeholder:  config.DefaultPagerdutyConfig.Client,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "client",
		},
		{
			Label:        "Client URL",
			Description:  "A backlink to the sender of the notification.",
			Placeholder:  config.DefaultPagerdutyConfig.ClientURL,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "client_url",
		},
		{
			Label:        "Description",
			Description:  "A description of the incident.",
			Placeholder:  config.DefaultPagerdutyConfig.Description,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "description",
		},
		{
			Label:        "Details",
			Description:  "A set of arbitrary key/value pairs that provide further detail about the incident.",
			Element:      schema.ElementTypeKeyValueMap,
			PropertyName: "details",
		},
		{
			Label:        "Images",
			Description:  "Images to attach to the incident.",
			Element:      schema.ElementSubformArray,
			PropertyName: "images",
			SubformOptions: []schema.Field{
				{
					Label:        "URL",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "href",
				},
				{
					Label:        "Source",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "source",
				},
				{
					Label:        "Alt",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "alt",
				},
			},
		},
		{
			Label:        "Links",
			Description:  "Links to attach to the incident.",
			Element:      schema.ElementSubformArray,
			PropertyName: "links",
			SubformOptions: []schema.Field{
				{
					Label:        "URL",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "href",
				},
				{
					Label:        "Text",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "text",
				},
			},
		},
		{
			Label:        "Source",
			Description:  "Unique location of the affected system.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "source",
		},
		{
			Label:        "Severity",
			Description:  "Severity of the incident.",
			Placeholder:  "error",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "severity",
		},
		{
			Label:        "Class",
			Description:  "The class/type of the event.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "class",
		},
		{
			Label:        "Component",
			Description:  "The part or component of the affected system that is broken.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "component",
		},
		{
			Label:        "Group",
			Description:  "A cluster or grouping of sources.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "group",
		},
		schema.V0HttpConfigOption(),
	},
}
