package v1

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

var weComEndpoint = "https://qyapi.weixin.qq.com"

const DefaultChannelType = "groupRobot"
const DefaultsgType = "markdown"
const DefaultToUser = "@all"

type MsgType string

const MsgTypeMarkdown MsgType = "markdown" // use these in available_receivers.go too
const MsgTypeText MsgType = "text"

// IsValid checks wecom message type
func (mt MsgType) IsValid() bool {
	return mt == MsgTypeMarkdown || mt == MsgTypeText
}

type Config struct {
	Channel     string  `json:"-" yaml:"-"`
	EndpointURL string  `json:"endpointUrl,omitempty" yaml:"endpointUrl,omitempty"`
	URL         string  `json:"url" yaml:"url"`
	AgentID     string  `json:"agent_id,omitempty" yaml:"agent_id,omitempty"`
	CorpID      string  `json:"corp_id,omitempty" yaml:"corp_id,omitempty"`
	Secret      string  `json:"secret,omitempty" yaml:"secret,omitempty"`
	MsgType     MsgType `json:"msgtype,omitempty" yaml:"msgtype,omitempty"`
	Message     string  `json:"message,omitempty" yaml:"message,omitempty"`
	Title       string  `json:"title,omitempty" yaml:"title,omitempty"`
	ToUser      string  `json:"touser,omitempty" yaml:"touser,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings = Config{
		Channel: DefaultChannelType,
	}

	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if len(settings.EndpointURL) == 0 {
		settings.EndpointURL = weComEndpoint
	}

	if !settings.MsgType.IsValid() {
		settings.MsgType = DefaultsgType
	}

	if len(settings.Message) == 0 {
		settings.Message = templates.DefaultMessageEmbed
	}
	if len(settings.Title) == 0 {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if len(settings.ToUser) == 0 {
		settings.ToUser = DefaultToUser
	}

	settings.URL = decryptFn("url", settings.URL)
	settings.Secret = decryptFn("secret", settings.Secret)

	if len(settings.URL) == 0 && len(settings.Secret) == 0 {
		return settings, errors.New("either url or secret is required")
	}

	if len(settings.URL) == 0 {
		settings.Channel = "apiapp"
		if len(settings.AgentID) == 0 {
			return settings, errors.New("could not find AgentID in settings")
		}
		if len(settings.CorpID) == 0 {
			return settings, errors.New("could not find CorpID in settings")
		}
	}

	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "Webhook URL",
			Description:  "Required if using GroupRobot",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx",
			PropertyName: "url",
			Secure:       true,
			Required:     true,
			DependsOn:    "secret",
			Protected:    true,
		},
		{
			Label:        "Agent ID",
			Description:  "Required if using APIAPP, see https://work.weixin.qq.com/wework_admin/frame#apps create ApiApp",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "1000002",
			PropertyName: "agent_id",
			Required:     true,
			DependsOn:    "url",
		},
		{
			Label:        "Corp ID",
			Description:  "Required if using APIAPP, see https://work.weixin.qq.com/wework_admin/frame#profile",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "wwxxxxxxxxx",
			PropertyName: "corp_id",
			Required:     true,
			DependsOn:    "url",
		},
		{
			Label:        "Secret",
			Description:  "Required if using APIAPP",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypePassword,
			Placeholder:  "secret",
			PropertyName: "secret",
			Secure:       true,
			Required:     true,
			DependsOn:    "url",
		},
		{
			Label:        "Message Type",
			Element:      schema.ElementTypeSelect,
			PropertyName: "msgtype",
			SelectOptions: []schema.SelectOption{
				{
					Value: "text",
					Label: "Text",
				},
				{
					Value: "markdown",
					Label: "Markdown",
				},
			},
			Placeholder: "Text",
		},
		{
			Label:        "Message",
			Description:  "Custom WeCom message. You can use template variables.",
			Element:      schema.ElementTypeTextArea,
			Placeholder:  templates.DefaultMessageEmbed,
			PropertyName: "message",
		},
		{ // New in 9.1.
			Label:        "Title",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Templated title of the message",
			PropertyName: "title",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
		{
			Label:        "To User",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "@all",
			PropertyName: "touser",
		},
	},
}
