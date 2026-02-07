package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config config.EmailConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "To",
			Description:  "The email address to send notifications to. You can enter multiple addresses using a \",\" separator. You can use templates to customize this field.",
			Element:      schema.ElementTypeTextArea,
			PropertyName: "to",
			Required:     true,
		},
		{
			Label:        "From",
			Description:  "The sender address.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "from",
		},
		{
			Label:        "SMTP host",
			Description:  "The SMTP host and port through which emails are sent.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "smarthost",
		},
		{
			Label:        "Hello",
			Description:  "The hostname to identify to the SMTP server.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "hello",
		},
		{
			Label:        "Username",
			Description:  "SMTP authentication information",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "auth_username",
		},
		{
			Label:        "Password",
			Description:  "SMTP authentication information",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypePassword,
			PropertyName: "auth_password",
			Secure:       true,
		},
		{
			Label:        "Secret",
			Description:  "SMTP authentication information",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypePassword,
			PropertyName: "auth_secret",
			Secure:       true,
		},
		{
			Label:        "Identity",
			Description:  "SMTP authentication information",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "auth_identity",
		},
		{
			Label:        "Require TLS",
			Description:  "The SMTP TLS requirement",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "require_tls",
		},
		{
			Label:        "Email HTML body",
			Description:  "The HTML body of the email notification.",
			Placeholder:  config.DefaultEmailConfig.HTML,
			Element:      schema.ElementTypeTextArea,
			PropertyName: "html",
		},
		{
			Label:        "Email text body",
			Description:  "The text body of the email notification.",
			Placeholder:  config.DefaultEmailConfig.Text,
			Element:      schema.ElementTypeTextArea,
			PropertyName: "text",
		},
		{
			Label:        "Headers",
			Description:  "Further headers email header key/value pairs. Overrides any headers previously set by the notification implementation.",
			Element:      schema.ElementTypeKeyValueMap,
			PropertyName: "headers",
		},
		schema.V0TLSConfigOption("tls_config"),
	},
}
