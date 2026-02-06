package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config config.JiraConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "API URL",
			Description:  "The host to send Jira API requests to",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
			Required:     true,
		},
		{
			Label:        "Project Key",
			Description:  "The project key where issues are created",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "project",
			Required:     true,
		},
		{
			Label:        "Issue Type",
			Description:  "Type of the issue (e.g. Bug)",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "issue_type",
			Required:     true,
		},
		{
			Label:        "Summary",
			Description:  "Issue summary template",
			Placeholder:  config.DefaultJiraConfig.Summary,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "summary",
		},
		{
			Label:        "Description",
			Description:  "Issue description template",
			Placeholder:  config.DefaultJiraConfig.Description,
			Element:      schema.ElementTypeTextArea,
			PropertyName: "description",
		},
		{
			Label:        "Labels",
			Description:  " Labels to be added to the issue",
			Element:      schema.ElementStringArray,
			PropertyName: "labels",
		},
		{
			Label:        "Priority",
			Description:  "Priority of the issue",
			Placeholder:  config.DefaultJiraConfig.Priority,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "priority",
		},
		{
			Label:        "Reopen transition",
			Description:  "Name of the workflow transition to reopen an issue. The target status should not have the category \"done\"",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "reopen_transition",
		},
		{
			Label:        "Resolve transition",
			Description:  "Name of the workflow transition to resolve an issue. The target status must have the category \"done\"",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "resolve_transition",
		},
		{
			Label:        "Won't fix resolution",
			Description:  "If \"Reopen transition\" is defined, ignore issues with that resolution",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "wont_fix_resolution",
		},
		{
			Label:        "Reopen duration",
			Description:  "If \"Reopen transition\" is defined, reopen the issue when it is not older than this value (rounded down to the nearest minute)",
			Placeholder:  "Use duration format, for example: 1.2s, 100ms",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "reopen_duration",
		},
		{
			Label:        "Fields",
			Description:  "Other issue and custom fields",
			Element:      schema.ElementTypeKeyValueMap,
			PropertyName: "fields",
		},
		schema.V0HttpConfigOption(),
	},
}
