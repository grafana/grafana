package v1

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/url"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const (
	Version = schema.V1

	MessageFormatJSON string = "json"
	MessageFormatText string = "text"
)

type Config struct {
	BrokerURL     string                   `json:"brokerUrl,omitempty" yaml:"brokerUrl,omitempty"`
	ClientID      string                   `json:"clientId,omitempty" yaml:"clientId,omitempty"`
	Topic         string                   `json:"topic,omitempty" yaml:"topic,omitempty"`
	Message       string                   `json:"message,omitempty" yaml:"message,omitempty"`
	MessageFormat string                   `json:"messageFormat,omitempty" yaml:"messageFormat,omitempty"`
	Username      string                   `json:"username,omitempty" yaml:"username,omitempty"`
	Password      string                   `json:"password,omitempty" yaml:"password,omitempty"`
	QoS           receivers.OptionalNumber `json:"qos,omitempty" yaml:"qos,omitempty"`
	Retain        bool                     `json:"retain,omitempty" yaml:"retain,omitempty"`
	TLSConfig     *receivers.TLSConfig     `json:"tlsConfig,omitempty" yaml:"tlsConfig,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.BrokerURL == "" {
		return Config{}, errors.New("MQTT broker URL must be specified")
	}

	if settings.Topic == "" {
		return Config{}, errors.New("MQTT topic must be specified")
	}

	if settings.ClientID == "" {
		settings.ClientID = fmt.Sprintf("grafana_%d", rand.Int31())
	}

	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}

	if settings.MessageFormat == "" {
		settings.MessageFormat = MessageFormatJSON
	}
	if settings.MessageFormat != MessageFormatJSON && settings.MessageFormat != MessageFormatText {
		return Config{}, errors.New("invalid message format, must be 'json' or 'text'")
	}

	qos, err := settings.QoS.Int64()
	if err != nil {
		return Config{}, fmt.Errorf("failed to parse QoS: %w", err)
	}
	if qos < 0 || qos > 2 {
		return Config{}, fmt.Errorf("invalid QoS level: %d. Must be 0, 1 or 2", qos)
	}

	settings.Password = decryptFn("password", settings.Password)

	if settings.TLSConfig == nil {
		settings.TLSConfig = &receivers.TLSConfig{}
	}

	settings.TLSConfig.CACertificate = decryptFn("tlsConfig.caCertificate", settings.TLSConfig.CACertificate)
	settings.TLSConfig.ClientCertificate = decryptFn("tlsConfig.clientCertificate", settings.TLSConfig.ClientCertificate)
	settings.TLSConfig.ClientKey = decryptFn("tlsConfig.clientKey", settings.TLSConfig.ClientKey)

	parsedURL, err := url.Parse(settings.BrokerURL)
	if err != nil {
		return Config{}, errors.New("failed to parse broker URL")
	}
	settings.TLSConfig.ServerName = parsedURL.Hostname()

	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "Broker URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "tcp://localhost:1883",
			Description:  "The URL of the MQTT broker.",
			PropertyName: "brokerUrl",
			Required:     true,
			Protected:    true,
		},
		{
			Label:        "Topic",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "grafana/alerts",
			Description:  "The topic to which the message will be sent.",
			PropertyName: "topic",
			Required:     true,
		},
		{
			Label:   "Message format",
			Element: schema.ElementTypeSelect,
			SelectOptions: []schema.SelectOption{
				{
					Value: MessageFormatJSON,
					Label: "json",
				},
				{
					Value: MessageFormatText,
					Label: "text",
				},
			},
			InputType:    schema.InputTypeText,
			Placeholder:  "json",
			Description:  "If set to 'json', the notification message is the default JSON payload, and the Message field sets only the message field in the payload. If set to 'text', the Message field defines the entire payload. The default is 'json'.",
			PropertyName: "messageFormat",
			Required:     false,
		},
		{
			Label:        "Client ID",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			Description:  "The client ID to use when connecting to the MQTT broker. If blank, a random client ID is used.",
			PropertyName: "clientId",
			Required:     false,
		},
		{
			Label:        "Message",
			Element:      schema.ElementTypeTextArea,
			Description:  "In 'json' Message format, sets the message field of the default JSON payload. In 'text' Message format, defines the entire payload.",
			Placeholder:  templates.DefaultMessageEmbed,
			PropertyName: "message",
		},
		{
			Label:        "Username",
			Description:  "The username to use when connecting to the MQTT broker.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "username",
			Required:     false,
		},
		{
			Label:        "Password",
			Description:  "The password to use when connecting to the MQTT broker.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "password",
			Required:     false,
			Secure:       true,
		},
		{
			Label:   "QoS",
			Element: schema.ElementTypeSelect,
			SelectOptions: []schema.SelectOption{
				{
					Value: "0",
					Label: "At most once (0)",
				},
				{
					Value: "1",
					Label: "At least once (1)",
				},
				{
					Value: "2",
					Label: "Exactly once (2)",
				},
			},
			Description:  "The quality of service to use when sending the message.",
			PropertyName: "qos",
			Required:     false,
		},
		{
			Label:        "Retain",
			Description:  "If set to true, the message will be retained by the broker.",
			Element:      schema.ElementTypeCheckbox,
			PropertyName: "retain",
			Required:     false,
		},
		{
			Label:        "TLS",
			PropertyName: "tlsConfig",
			Description:  "TLS configuration options",
			Element:      schema.ElementTypeSubform,
			SubformOptions: []schema.Field{
				{
					Label:        "Disable certificate verification",
					Element:      schema.ElementTypeCheckbox,
					Description:  "Do not verify the broker's certificate chain and host name.",
					PropertyName: "insecureSkipVerify",
					Required:     false,
				},
				{
					Label:        "CA Certificate",
					Element:      schema.ElementTypeTextArea,
					Description:  "Certificate in PEM format to use when verifying the broker's certificate chain.",
					InputType:    schema.InputTypeText,
					PropertyName: "caCertificate",
					Required:     false,
					Secure:       true,
				},
				{
					Label:        "Client Certificate",
					Element:      schema.ElementTypeTextArea,
					Description:  "Client certificate in PEM format to use when connecting to the broker.",
					InputType:    schema.InputTypeText,
					PropertyName: "clientCertificate",
					Required:     false,
					Secure:       true,
				},
				{
					Label:        "Client Key",
					Element:      schema.ElementTypeTextArea,
					Description:  "Client key in PEM format to use when connecting to the broker.",
					InputType:    schema.InputTypeText,
					PropertyName: "clientKey",
					Required:     false,
					Secure:       true,
				},
			},
		},
	},
}
