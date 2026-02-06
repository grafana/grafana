package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.WechatConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "API URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
		},
		{
			Label:        "API Secret",
			Description:  "The API key to use when talking to the WeChat API",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_secret",
			Secure:       true,
		},
		{
			Label:        "Corp ID",
			Description:  "The corp id for authentication",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "corp_id",
		},
		{
			Label:        "Message",
			Description:  "API request data as defined by the WeChat API",
			Placeholder:  config.DefaultWechatConfig.Message,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message",
		},
		{
			Label:        "Message type",
			Description:  "Type of the message type",
			Element:      schema.ElementTypeSelect,
			PropertyName: "message_type",
			Placeholder:  "text",
			SelectOptions: []schema.SelectOption{
				{Value: "text", Label: "Text"},
				{Value: "markdown", Label: "Markdown"},
			},
		},
		{
			Label:        "Agent ID",
			Placeholder:  config.DefaultWechatConfig.AgentID,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "agent_id",
		},
		{
			Label:        "To User",
			Placeholder:  config.DefaultWechatConfig.ToUser,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "to_user",
		},
		{
			Label:        "To Party",
			Placeholder:  config.DefaultWechatConfig.ToParty,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "to_party",
		},
		{
			Label:        "To Tag",
			Placeholder:  config.DefaultWechatConfig.ToTag,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "to_tag",
		},
		schema.V0HttpConfigOption(),
	},
}
