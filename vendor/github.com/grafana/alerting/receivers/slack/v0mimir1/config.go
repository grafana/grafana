package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.SlackConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "Webhook URL",
			Description:  "The Slack webhook URL.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
			Secure:       true,
			Required:     true,
		},
		{
			Label:        "Channel",
			Description:  "The #channel or @user to send notifications to.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "channel",
		},
		{
			Label:        "Username",
			Placeholder:  config.DefaultSlackConfig.Username,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "username",
		},
		{
			Label:        "Emoji icon",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "icon_emoji",
		},
		{
			Label:        "Icon URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "icon_url",
		},
		{
			Label:        "Names link",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "link_names",
		},
		{
			Label:        "Callback ID",
			Placeholder:  config.DefaultSlackConfig.CallbackID,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "callback_id",
		},
		{
			Label:        "Color",
			Placeholder:  config.DefaultSlackConfig.Color,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "color",
		},
		{
			Label:        "Fallback",
			Placeholder:  config.DefaultSlackConfig.Fallback,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "fallback",
		},
		{
			Label:        "Footer",
			Placeholder:  config.DefaultSlackConfig.Footer,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "footer",
		},
		{
			Label:        "Markdown Fields",
			Description:  "An array of field names that should be formatted by markdown syntax.",
			Element:      schema.ElementStringArray,
			PropertyName: "mrkdwn_in",
		},
		{
			Label:        "Pre-text",
			Placeholder:  config.DefaultSlackConfig.Pretext,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "pretext",
		},
		{
			Label:        "Short Fields",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "short_fields",
		},
		{
			Label:        "Message body",
			Placeholder:  config.DefaultSlackConfig.Text,
			Element:      schema.ElementTypeTextArea,
			PropertyName: "text",
		},
		{
			Label:        "Title",
			Placeholder:  config.DefaultSlackConfig.Title,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "title",
		},
		{
			Label:        "Title Link",
			Placeholder:  config.DefaultSlackConfig.TitleLink,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "title_link",
		},
		{
			Label:        "Image URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "image_url",
		},
		{
			Label:        "Thumbnail URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "thumb_url",
		},
		{
			Label:        "Actions",
			Element:      schema.ElementSubformArray,
			PropertyName: "actions",
			SubformOptions: []schema.Field{
				{
					Label:        "Text",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "text",
					Required:     true,
				},
				{
					Label:        "Type",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "type",
					Required:     true,
				},
				{
					Label:        "URL",
					Description:  "Either url or name and value are mandatory.",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "url",
				},
				{
					Label:        "Name",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "name",
				},
				{
					Label:        "Value",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "value",
				},
				{
					Label:        "Confirm",
					Element:      schema.ElementTypeSubform,
					PropertyName: "confirm",
					SubformOptions: []schema.Field{
						{
							Label:        "Text",
							Element:      schema.ElementTypeInput,
							InputType:    schema.InputTypeText,
							PropertyName: "text",
							Required:     true,
						},
						{
							Label:        "Dismiss text",
							Element:      schema.ElementTypeInput,
							InputType:    schema.InputTypeText,
							PropertyName: "dismiss_text",
						},
						{
							Label:        "OK text",
							Element:      schema.ElementTypeInput,
							InputType:    schema.InputTypeText,
							PropertyName: "ok_text",
						},
						{
							Label:        "Title",
							Element:      schema.ElementTypeInput,
							InputType:    schema.InputTypeText,
							PropertyName: "title",
						},
					},
				},
				{
					Label:        "Style",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "style",
				},
			},
		},
		{
			Label:        "Fields",
			Element:      schema.ElementSubformArray,
			PropertyName: "fields",
			SubformOptions: []schema.Field{
				{
					Label:        "Title",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "title",
					Required:     true,
				},
				{
					Label:        "Value",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "value",
					Required:     true,
				},
				{
					Label:        "Short",
					Element:      schema.ElementTypeCheckbox,
					PropertyName: "short",
				},
			},
		},
		schema.V0HttpConfigOption(),
	},
}
