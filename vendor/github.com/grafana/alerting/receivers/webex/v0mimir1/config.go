package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.WebexConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "API URL",
			Description:  "The Webex Teams API URL",
			Placeholder:  "https://webexapis.com/v1/messages",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
		},
		{
			Label:        "Room ID",
			Description:  "ID of the Webex Teams room where to send the messages",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "room_id",
			Required:     true,
		},
		{
			Label:        "Message",
			Description:  "Message template",
			Placeholder:  config.DefaultWebexConfig.Message,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message",
		},
		schema.V0HttpConfigOption(),
	},
}
