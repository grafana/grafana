// Copyright 2015 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"errors"
	"fmt"
	"net/textproto"
	"regexp"
	"strings"
	"text/template"
	"time"

	commoncfg "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/sigv4"
)

var (
	// DefaultWebhookConfig defines default values for Webhook configurations.
	DefaultWebhookConfig = WebhookConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
	}

	// DefaultWebexConfig defines default values for Webex configurations.
	DefaultWebexConfig = WebexConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Message: `{{ template "webex.default.message" . }}`,
	}

	// DefaultDiscordConfig defines default values for Discord configurations.
	DefaultDiscordConfig = DiscordConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Title:   `{{ template "discord.default.title" . }}`,
		Message: `{{ template "discord.default.message" . }}`,
	}

	// DefaultEmailConfig defines default values for Email configurations.
	DefaultEmailConfig = EmailConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: false,
		},
		HTML: `{{ template "email.default.html" . }}`,
		Text: ``,
	}

	// DefaultEmailSubject defines the default Subject header of an Email.
	DefaultEmailSubject = `{{ template "email.default.subject" . }}`

	// DefaultPagerdutyDetails defines the default values for PagerDuty details.
	DefaultPagerdutyDetails = map[string]string{
		"firing":       `{{ template "pagerduty.default.instances" .Alerts.Firing }}`,
		"resolved":     `{{ template "pagerduty.default.instances" .Alerts.Resolved }}`,
		"num_firing":   `{{ .Alerts.Firing | len }}`,
		"num_resolved": `{{ .Alerts.Resolved | len }}`,
	}

	// DefaultPagerdutyConfig defines default values for PagerDuty configurations.
	DefaultPagerdutyConfig = PagerdutyConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Description: `{{ template "pagerduty.default.description" .}}`,
		Client:      `{{ template "pagerduty.default.client" . }}`,
		ClientURL:   `{{ template "pagerduty.default.clientURL" . }}`,
	}

	// DefaultSlackConfig defines default values for Slack configurations.
	DefaultSlackConfig = SlackConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: false,
		},
		Color:      `{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}`,
		Username:   `{{ template "slack.default.username" . }}`,
		Title:      `{{ template "slack.default.title" . }}`,
		TitleLink:  `{{ template "slack.default.titlelink" . }}`,
		IconEmoji:  `{{ template "slack.default.iconemoji" . }}`,
		IconURL:    `{{ template "slack.default.iconurl" . }}`,
		Pretext:    `{{ template "slack.default.pretext" . }}`,
		Text:       `{{ template "slack.default.text" . }}`,
		Fallback:   `{{ template "slack.default.fallback" . }}`,
		CallbackID: `{{ template "slack.default.callbackid" . }}`,
		Footer:     `{{ template "slack.default.footer" . }}`,
	}

	// DefaultOpsGenieConfig defines default values for OpsGenie configurations.
	DefaultOpsGenieConfig = OpsGenieConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Message:     `{{ template "opsgenie.default.message" . }}`,
		Description: `{{ template "opsgenie.default.description" . }}`,
		Source:      `{{ template "opsgenie.default.source" . }}`,
		// TODO: Add a details field with all the alerts.
	}

	// DefaultWechatConfig defines default values for wechat configurations.
	DefaultWechatConfig = WechatConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: false,
		},
		Message: `{{ template "wechat.default.message" . }}`,
		ToUser:  `{{ template "wechat.default.to_user" . }}`,
		ToParty: `{{ template "wechat.default.to_party" . }}`,
		ToTag:   `{{ template "wechat.default.to_tag" . }}`,
		AgentID: `{{ template "wechat.default.agent_id" . }}`,
	}

	// DefaultVictorOpsConfig defines default values for VictorOps configurations.
	DefaultVictorOpsConfig = VictorOpsConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		MessageType:       `CRITICAL`,
		StateMessage:      `{{ template "victorops.default.state_message" . }}`,
		EntityDisplayName: `{{ template "victorops.default.entity_display_name" . }}`,
		MonitoringTool:    `{{ template "victorops.default.monitoring_tool" . }}`,
	}

	// DefaultPushoverConfig defines default values for Pushover configurations.
	DefaultPushoverConfig = PushoverConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Title:    `{{ template "pushover.default.title" . }}`,
		Message:  `{{ template "pushover.default.message" . }}`,
		URL:      `{{ template "pushover.default.url" . }}`,
		Priority: `{{ if eq .Status "firing" }}2{{ else }}0{{ end }}`, // emergency (firing) or normal
		Retry:    duration(1 * time.Minute),
		Expire:   duration(1 * time.Hour),
		HTML:     false,
	}

	// DefaultSNSConfig defines default values for SNS configurations.
	DefaultSNSConfig = SNSConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Subject: `{{ template "sns.default.subject" . }}`,
		Message: `{{ template "sns.default.message" . }}`,
	}

	DefaultTelegramConfig = TelegramConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		DisableNotifications: false,
		Message:              `{{ template "telegram.default.message" . }}`,
		ParseMode:            "HTML",
	}

	DefaultMSTeamsConfig = MSTeamsConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Title:   `{{ template "msteams.default.title" . }}`,
		Summary: `{{ template "msteams.default.summary" . }}`,
		Text:    `{{ template "msteams.default.text" . }}`,
	}

	DefaultMSTeamsV2Config = MSTeamsV2Config{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Title: `{{ template "msteamsv2.default.title" . }}`,
		Text:  `{{ template "msteamsv2.default.text" . }}`,
	}

	DefaultJiraConfig = JiraConfig{
		NotifierConfig: NotifierConfig{
			VSendResolved: true,
		},
		Summary:     `{{ template "jira.default.summary" . }}`,
		Description: `{{ template "jira.default.description" . }}`,
		Priority:    `{{ template "jira.default.priority" . }}`,
	}
)

// NotifierConfig contains base options common across all notifier configurations.
type NotifierConfig struct {
	VSendResolved bool `yaml:"send_resolved" json:"send_resolved"`
}

func (nc *NotifierConfig) SendResolved() bool {
	return nc.VSendResolved
}

// WebexConfig configures notifications via Webex.
type WebexConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`
	HTTPConfig     *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`
	APIURL         *URL                        `yaml:"api_url,omitempty" json:"api_url,omitempty"`

	Message string `yaml:"message,omitempty" json:"message,omitempty"`
	RoomID  string `yaml:"room_id" json:"room_id"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *WebexConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultWebexConfig
	type plain WebexConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.RoomID == "" {
		return errors.New("missing room_id on webex_config")
	}

	if c.HTTPConfig == nil || c.HTTPConfig.Authorization == nil {
		return errors.New("missing webex_configs.http_config.authorization")
	}

	return nil
}

// DiscordConfig configures notifications via Discord.
type DiscordConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig     *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`
	WebhookURL     *SecretURL                  `yaml:"webhook_url,omitempty" json:"webhook_url,omitempty"`
	WebhookURLFile string                      `yaml:"webhook_url_file,omitempty" json:"webhook_url_file,omitempty"`

	Title   string `yaml:"title,omitempty" json:"title,omitempty"`
	Message string `yaml:"message,omitempty" json:"message,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *DiscordConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultDiscordConfig
	type plain DiscordConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.WebhookURL == nil && c.WebhookURLFile == "" {
		return errors.New("one of webhook_url or webhook_url_file must be configured")
	}

	if c.WebhookURL != nil && len(c.WebhookURLFile) > 0 {
		return errors.New("at most one of webhook_url & webhook_url_file must be configured")
	}

	return nil
}

// EmailConfig configures notifications via mail.
type EmailConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	// Email address to notify.
	To               string              `yaml:"to,omitempty" json:"to,omitempty"`
	From             string              `yaml:"from,omitempty" json:"from,omitempty"`
	Hello            string              `yaml:"hello,omitempty" json:"hello,omitempty"`
	Smarthost        HostPort            `yaml:"smarthost,omitempty" json:"smarthost,omitempty"`
	AuthUsername     string              `yaml:"auth_username,omitempty" json:"auth_username,omitempty"`
	AuthPassword     Secret              `yaml:"auth_password,omitempty" json:"auth_password,omitempty"`
	AuthPasswordFile string              `yaml:"auth_password_file,omitempty" json:"auth_password_file,omitempty"`
	AuthSecret       Secret              `yaml:"auth_secret,omitempty" json:"auth_secret,omitempty"`
	AuthIdentity     string              `yaml:"auth_identity,omitempty" json:"auth_identity,omitempty"`
	Headers          map[string]string   `yaml:"headers,omitempty" json:"headers,omitempty"`
	HTML             string              `yaml:"html,omitempty" json:"html,omitempty"`
	Text             string              `yaml:"text,omitempty" json:"text,omitempty"`
	RequireTLS       *bool               `yaml:"require_tls,omitempty" json:"require_tls,omitempty"`
	TLSConfig        commoncfg.TLSConfig `yaml:"tls_config,omitempty" json:"tls_config,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *EmailConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultEmailConfig
	type plain EmailConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.To == "" {
		return errors.New("missing to address in email config")
	}
	// Header names are case-insensitive, check for collisions.
	normalizedHeaders := map[string]string{}
	for h, v := range c.Headers {
		normalized := textproto.CanonicalMIMEHeaderKey(h)
		if _, ok := normalizedHeaders[normalized]; ok {
			return fmt.Errorf("duplicate header %q in email config", normalized)
		}
		normalizedHeaders[normalized] = v
	}
	c.Headers = normalizedHeaders

	return nil
}

// PagerdutyConfig configures notifications via PagerDuty.
type PagerdutyConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	ServiceKey     Secret            `yaml:"service_key,omitempty" json:"service_key,omitempty"`
	ServiceKeyFile string            `yaml:"service_key_file,omitempty" json:"service_key_file,omitempty"`
	RoutingKey     Secret            `yaml:"routing_key,omitempty" json:"routing_key,omitempty"`
	RoutingKeyFile string            `yaml:"routing_key_file,omitempty" json:"routing_key_file,omitempty"`
	URL            *URL              `yaml:"url,omitempty" json:"url,omitempty"`
	Client         string            `yaml:"client,omitempty" json:"client,omitempty"`
	ClientURL      string            `yaml:"client_url,omitempty" json:"client_url,omitempty"`
	Description    string            `yaml:"description,omitempty" json:"description,omitempty"`
	Details        map[string]string `yaml:"details,omitempty" json:"details,omitempty"`
	Images         []PagerdutyImage  `yaml:"images,omitempty" json:"images,omitempty"`
	Links          []PagerdutyLink   `yaml:"links,omitempty" json:"links,omitempty"`
	Source         string            `yaml:"source,omitempty" json:"source,omitempty"`
	Severity       string            `yaml:"severity,omitempty" json:"severity,omitempty"`
	Class          string            `yaml:"class,omitempty" json:"class,omitempty"`
	Component      string            `yaml:"component,omitempty" json:"component,omitempty"`
	Group          string            `yaml:"group,omitempty" json:"group,omitempty"`
}

// PagerdutyLink is a link.
type PagerdutyLink struct {
	Href string `yaml:"href,omitempty" json:"href,omitempty"`
	Text string `yaml:"text,omitempty" json:"text,omitempty"`
}

// PagerdutyImage is an image.
type PagerdutyImage struct {
	Src  string `yaml:"src,omitempty" json:"src,omitempty"`
	Alt  string `yaml:"alt,omitempty" json:"alt,omitempty"`
	Href string `yaml:"href,omitempty" json:"href,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *PagerdutyConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultPagerdutyConfig
	type plain PagerdutyConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.RoutingKey == "" && c.ServiceKey == "" && c.RoutingKeyFile == "" && c.ServiceKeyFile == "" {
		return errors.New("missing service or routing key in PagerDuty config")
	}
	if len(c.RoutingKey) > 0 && len(c.RoutingKeyFile) > 0 {
		return errors.New("at most one of routing_key & routing_key_file must be configured")
	}
	if len(c.ServiceKey) > 0 && len(c.ServiceKeyFile) > 0 {
		return errors.New("at most one of service_key & service_key_file must be configured")
	}
	if c.Details == nil {
		c.Details = make(map[string]string)
	}
	if c.Source == "" {
		c.Source = c.Client
	}
	for k, v := range DefaultPagerdutyDetails {
		if _, ok := c.Details[k]; !ok {
			c.Details[k] = v
		}
	}
	return nil
}

// SlackAction configures a single Slack action that is sent with each notification.
// See https://api.slack.com/docs/message-attachments#action_fields and https://api.slack.com/docs/message-buttons
// for more information.
type SlackAction struct {
	Type         string                  `yaml:"type,omitempty"  json:"type,omitempty"`
	Text         string                  `yaml:"text,omitempty"  json:"text,omitempty"`
	URL          string                  `yaml:"url,omitempty"   json:"url,omitempty"`
	Style        string                  `yaml:"style,omitempty" json:"style,omitempty"`
	Name         string                  `yaml:"name,omitempty"  json:"name,omitempty"`
	Value        string                  `yaml:"value,omitempty"  json:"value,omitempty"`
	ConfirmField *SlackConfirmationField `yaml:"confirm,omitempty"  json:"confirm,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for SlackAction.
func (c *SlackAction) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain SlackAction
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.Type == "" {
		return errors.New("missing type in Slack action configuration")
	}
	if c.Text == "" {
		return errors.New("missing text in Slack action configuration")
	}
	if c.URL != "" {
		// Clear all message action fields.
		c.Name = ""
		c.Value = ""
		c.ConfirmField = nil
	} else if c.Name != "" {
		c.URL = ""
	} else {
		return errors.New("missing name or url in Slack action configuration")
	}
	return nil
}

// SlackConfirmationField protect users from destructive actions or particularly distinguished decisions
// by asking them to confirm their button click one more time.
// See https://api.slack.com/docs/interactive-message-field-guide#confirmation_fields for more information.
type SlackConfirmationField struct {
	Text        string `yaml:"text,omitempty"  json:"text,omitempty"`
	Title       string `yaml:"title,omitempty"  json:"title,omitempty"`
	OkText      string `yaml:"ok_text,omitempty"  json:"ok_text,omitempty"`
	DismissText string `yaml:"dismiss_text,omitempty"  json:"dismiss_text,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for SlackConfirmationField.
func (c *SlackConfirmationField) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain SlackConfirmationField
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.Text == "" {
		return errors.New("missing text in Slack confirmation configuration")
	}
	return nil
}

// SlackField configures a single Slack field that is sent with each notification.
// Each field must contain a title, value, and optionally, a boolean value to indicate if the field
// is short enough to be displayed next to other fields designated as short.
// See https://api.slack.com/docs/message-attachments#fields for more information.
type SlackField struct {
	Title string `yaml:"title,omitempty" json:"title,omitempty"`
	Value string `yaml:"value,omitempty" json:"value,omitempty"`
	Short *bool  `yaml:"short,omitempty" json:"short,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for SlackField.
func (c *SlackField) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain SlackField
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.Title == "" {
		return errors.New("missing title in Slack field configuration")
	}
	if c.Value == "" {
		return errors.New("missing value in Slack field configuration")
	}
	return nil
}

// SlackConfig configures notifications via Slack.
type SlackConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	APIURL     *SecretURL `yaml:"api_url,omitempty" json:"api_url,omitempty"`
	APIURLFile string     `yaml:"api_url_file,omitempty" json:"api_url_file,omitempty"`

	// Slack channel override, (like #other-channel or @username).
	Channel  string `yaml:"channel,omitempty" json:"channel,omitempty"`
	Username string `yaml:"username,omitempty" json:"username,omitempty"`
	Color    string `yaml:"color,omitempty" json:"color,omitempty"`

	Title       string         `yaml:"title,omitempty" json:"title,omitempty"`
	TitleLink   string         `yaml:"title_link,omitempty" json:"title_link,omitempty"`
	Pretext     string         `yaml:"pretext,omitempty" json:"pretext,omitempty"`
	Text        string         `yaml:"text,omitempty" json:"text,omitempty"`
	Fields      []*SlackField  `yaml:"fields,omitempty" json:"fields,omitempty"`
	ShortFields bool           `yaml:"short_fields" json:"short_fields,omitempty"`
	Footer      string         `yaml:"footer,omitempty" json:"footer,omitempty"`
	Fallback    string         `yaml:"fallback,omitempty" json:"fallback,omitempty"`
	CallbackID  string         `yaml:"callback_id,omitempty" json:"callback_id,omitempty"`
	IconEmoji   string         `yaml:"icon_emoji,omitempty" json:"icon_emoji,omitempty"`
	IconURL     string         `yaml:"icon_url,omitempty" json:"icon_url,omitempty"`
	ImageURL    string         `yaml:"image_url,omitempty" json:"image_url,omitempty"`
	ThumbURL    string         `yaml:"thumb_url,omitempty" json:"thumb_url,omitempty"`
	LinkNames   bool           `yaml:"link_names" json:"link_names,omitempty"`
	MrkdwnIn    []string       `yaml:"mrkdwn_in,omitempty" json:"mrkdwn_in,omitempty"`
	Actions     []*SlackAction `yaml:"actions,omitempty" json:"actions,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *SlackConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultSlackConfig
	type plain SlackConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.APIURL != nil && len(c.APIURLFile) > 0 {
		return errors.New("at most one of api_url & api_url_file must be configured")
	}

	return nil
}

// WebhookConfig configures notifications via a generic webhook.
type WebhookConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	// URL to send POST request to.
	URL     *SecretURL `yaml:"url" json:"url"`
	URLFile string     `yaml:"url_file" json:"url_file"`

	// MaxAlerts is the maximum number of alerts to be sent per webhook message.
	// Alerts exceeding this threshold will be truncated. Setting this to 0
	// allows an unlimited number of alerts.
	MaxAlerts uint64 `yaml:"max_alerts" json:"max_alerts"`

	// Timeout is the maximum time allowed to invoke the webhook. Setting this to 0
	// does not impose a timeout.
	Timeout model.Duration `yaml:"timeout" json:"timeout"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *WebhookConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultWebhookConfig
	type plain WebhookConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.URL == nil && c.URLFile == "" {
		return errors.New("one of url or url_file must be configured")
	}
	if c.URL != nil && c.URLFile != "" {
		return errors.New("at most one of url & url_file must be configured")
	}
	return nil
}

// WechatConfig configures notifications via Wechat.
type WechatConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	APISecret   Secret `yaml:"api_secret,omitempty" json:"api_secret,omitempty"`
	CorpID      string `yaml:"corp_id,omitempty" json:"corp_id,omitempty"`
	Message     string `yaml:"message,omitempty" json:"message,omitempty"`
	APIURL      *URL   `yaml:"api_url,omitempty" json:"api_url,omitempty"`
	ToUser      string `yaml:"to_user,omitempty" json:"to_user,omitempty"`
	ToParty     string `yaml:"to_party,omitempty" json:"to_party,omitempty"`
	ToTag       string `yaml:"to_tag,omitempty" json:"to_tag,omitempty"`
	AgentID     string `yaml:"agent_id,omitempty" json:"agent_id,omitempty"`
	MessageType string `yaml:"message_type,omitempty" json:"message_type,omitempty"`
}

const wechatValidTypesRe = `^(text|markdown)$`

var wechatTypeMatcher = regexp.MustCompile(wechatValidTypesRe)

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *WechatConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultWechatConfig
	type plain WechatConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.MessageType == "" {
		c.MessageType = "text"
	}

	if !wechatTypeMatcher.MatchString(c.MessageType) {
		return fmt.Errorf("weChat message type %q does not match valid options %s", c.MessageType, wechatValidTypesRe)
	}

	return nil
}

// OpsGenieConfig configures notifications via OpsGenie.
type OpsGenieConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	APIKey       Secret                    `yaml:"api_key,omitempty" json:"api_key,omitempty"`
	APIKeyFile   string                    `yaml:"api_key_file,omitempty" json:"api_key_file,omitempty"`
	APIURL       *URL                      `yaml:"api_url,omitempty" json:"api_url,omitempty"`
	Message      string                    `yaml:"message,omitempty" json:"message,omitempty"`
	Description  string                    `yaml:"description,omitempty" json:"description,omitempty"`
	Source       string                    `yaml:"source,omitempty" json:"source,omitempty"`
	Details      map[string]string         `yaml:"details,omitempty" json:"details,omitempty"`
	Entity       string                    `yaml:"entity,omitempty" json:"entity,omitempty"`
	Responders   []OpsGenieConfigResponder `yaml:"responders,omitempty" json:"responders,omitempty"`
	Actions      string                    `yaml:"actions,omitempty" json:"actions,omitempty"`
	Tags         string                    `yaml:"tags,omitempty" json:"tags,omitempty"`
	Note         string                    `yaml:"note,omitempty" json:"note,omitempty"`
	Priority     string                    `yaml:"priority,omitempty" json:"priority,omitempty"`
	UpdateAlerts bool                      `yaml:"update_alerts,omitempty" json:"update_alerts,omitempty"`
}

const opsgenieValidTypesRe = `^(team|teams|user|escalation|schedule)$`

var opsgenieTypeMatcher = regexp.MustCompile(opsgenieValidTypesRe)

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *OpsGenieConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultOpsGenieConfig
	type plain OpsGenieConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.APIKey != "" && len(c.APIKeyFile) > 0 {
		return errors.New("at most one of api_key & api_key_file must be configured")
	}

	for _, r := range c.Responders {
		if r.ID == "" && r.Username == "" && r.Name == "" {
			return fmt.Errorf("opsGenieConfig responder %v has to have at least one of id, username or name specified", r)
		}

		if strings.Contains(r.Type, "{{") {
			_, err := template.New("").Parse(r.Type)
			if err != nil {
				return fmt.Errorf("opsGenieConfig responder %v type is not a valid template: %w", r, err)
			}
		} else {
			r.Type = strings.ToLower(r.Type)
			if !opsgenieTypeMatcher.MatchString(r.Type) {
				return fmt.Errorf("opsGenieConfig responder %v type does not match valid options %s", r, opsgenieValidTypesRe)
			}
		}
	}

	return nil
}

type OpsGenieConfigResponder struct {
	// One of those 3 should be filled.
	ID       string `yaml:"id,omitempty" json:"id,omitempty"`
	Name     string `yaml:"name,omitempty" json:"name,omitempty"`
	Username string `yaml:"username,omitempty" json:"username,omitempty"`

	// team, user, escalation, schedule etc.
	Type string `yaml:"type,omitempty" json:"type,omitempty"`
}

// VictorOpsConfig configures notifications via VictorOps.
type VictorOpsConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	APIKey            Secret            `yaml:"api_key,omitempty" json:"api_key,omitempty"`
	APIKeyFile        string            `yaml:"api_key_file,omitempty" json:"api_key_file,omitempty"`
	APIURL            *URL              `yaml:"api_url" json:"api_url"`
	RoutingKey        string            `yaml:"routing_key" json:"routing_key"`
	MessageType       string            `yaml:"message_type" json:"message_type"`
	StateMessage      string            `yaml:"state_message" json:"state_message"`
	EntityDisplayName string            `yaml:"entity_display_name" json:"entity_display_name"`
	MonitoringTool    string            `yaml:"monitoring_tool" json:"monitoring_tool"`
	CustomFields      map[string]string `yaml:"custom_fields,omitempty" json:"custom_fields,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *VictorOpsConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultVictorOpsConfig
	type plain VictorOpsConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.RoutingKey == "" {
		return errors.New("missing Routing key in VictorOps config")
	}
	if c.APIKey != "" && len(c.APIKeyFile) > 0 {
		return errors.New("at most one of api_key & api_key_file must be configured")
	}

	reservedFields := []string{"routing_key", "message_type", "state_message", "entity_display_name", "monitoring_tool", "entity_id", "entity_state"}

	for _, v := range reservedFields {
		if _, ok := c.CustomFields[v]; ok {
			return fmt.Errorf("victorOps config contains custom field %s which cannot be used as it conflicts with the fixed/static fields", v)
		}
	}

	return nil
}

type duration time.Duration

func (d *duration) UnmarshalText(text []byte) error {
	parsed, err := time.ParseDuration(string(text))
	if err == nil {
		*d = duration(parsed)
	}
	return err
}

func (d duration) MarshalText() ([]byte, error) {
	return []byte(time.Duration(d).String()), nil
}

type PushoverConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	UserKey     Secret   `yaml:"user_key,omitempty" json:"user_key,omitempty"`
	UserKeyFile string   `yaml:"user_key_file,omitempty" json:"user_key_file,omitempty"`
	Token       Secret   `yaml:"token,omitempty" json:"token,omitempty"`
	TokenFile   string   `yaml:"token_file,omitempty" json:"token_file,omitempty"`
	Title       string   `yaml:"title,omitempty" json:"title,omitempty"`
	Message     string   `yaml:"message,omitempty" json:"message,omitempty"`
	URL         string   `yaml:"url,omitempty" json:"url,omitempty"`
	URLTitle    string   `yaml:"url_title,omitempty" json:"url_title,omitempty"`
	Device      string   `yaml:"device,omitempty" json:"device,omitempty"`
	Sound       string   `yaml:"sound,omitempty" json:"sound,omitempty"`
	Priority    string   `yaml:"priority,omitempty" json:"priority,omitempty"`
	Retry       duration `yaml:"retry,omitempty" json:"retry,omitempty"`
	Expire      duration `yaml:"expire,omitempty" json:"expire,omitempty"`
	TTL         duration `yaml:"ttl,omitempty" json:"ttl,omitempty"`
	HTML        bool     `yaml:"html" json:"html,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *PushoverConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultPushoverConfig
	type plain PushoverConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.UserKey == "" && c.UserKeyFile == "" {
		return errors.New("one of user_key or user_key_file must be configured")
	}
	if c.UserKey != "" && c.UserKeyFile != "" {
		return errors.New("at most one of user_key & user_key_file must be configured")
	}
	if c.Token == "" && c.TokenFile == "" {
		return errors.New("one of token or token_file must be configured")
	}
	if c.Token != "" && c.TokenFile != "" {
		return errors.New("at most one of token & token_file must be configured")
	}
	return nil
}

type SNSConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	APIUrl      string            `yaml:"api_url,omitempty" json:"api_url,omitempty"`
	Sigv4       sigv4.SigV4Config `yaml:"sigv4" json:"sigv4"`
	TopicARN    string            `yaml:"topic_arn,omitempty" json:"topic_arn,omitempty"`
	PhoneNumber string            `yaml:"phone_number,omitempty" json:"phone_number,omitempty"`
	TargetARN   string            `yaml:"target_arn,omitempty" json:"target_arn,omitempty"`
	Subject     string            `yaml:"subject,omitempty" json:"subject,omitempty"`
	Message     string            `yaml:"message,omitempty" json:"message,omitempty"`
	Attributes  map[string]string `yaml:"attributes,omitempty" json:"attributes,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *SNSConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultSNSConfig
	type plain SNSConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if (c.TargetARN == "") != (c.TopicARN == "") != (c.PhoneNumber == "") {
		return errors.New("must provide either a Target ARN, Topic ARN, or Phone Number for SNS config")
	}
	return nil
}

// TelegramConfig configures notifications via Telegram.
type TelegramConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`

	HTTPConfig *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	APIUrl               *URL   `yaml:"api_url" json:"api_url,omitempty"`
	BotToken             Secret `yaml:"bot_token,omitempty" json:"token,omitempty"`
	BotTokenFile         string `yaml:"bot_token_file,omitempty" json:"token_file,omitempty"`
	ChatID               int64  `yaml:"chat_id,omitempty" json:"chat,omitempty"`
	Message              string `yaml:"message,omitempty" json:"message,omitempty"`
	DisableNotifications bool   `yaml:"disable_notifications,omitempty" json:"disable_notifications,omitempty"`
	ParseMode            string `yaml:"parse_mode,omitempty" json:"parse_mode,omitempty"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *TelegramConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultTelegramConfig
	type plain TelegramConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.BotToken == "" && c.BotTokenFile == "" {
		return errors.New("missing bot_token or bot_token_file on telegram_config")
	}
	if c.BotToken != "" && c.BotTokenFile != "" {
		return errors.New("at most one of bot_token & bot_token_file must be configured")
	}
	if c.ChatID == 0 {
		return errors.New("missing chat_id on telegram_config")
	}
	if c.ParseMode != "" &&
		c.ParseMode != "Markdown" &&
		c.ParseMode != "MarkdownV2" &&
		c.ParseMode != "HTML" {
		return errors.New("unknown parse_mode on telegram_config, must be Markdown, MarkdownV2, HTML or empty string")
	}
	return nil
}

type MSTeamsConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`
	HTTPConfig     *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`
	WebhookURL     *SecretURL                  `yaml:"webhook_url,omitempty" json:"webhook_url,omitempty"`
	WebhookURLFile string                      `yaml:"webhook_url_file,omitempty" json:"webhook_url_file,omitempty"`

	Title   string `yaml:"title,omitempty" json:"title,omitempty"`
	Summary string `yaml:"summary,omitempty" json:"summary,omitempty"`
	Text    string `yaml:"text,omitempty" json:"text,omitempty"`
}

func (c *MSTeamsConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultMSTeamsConfig
	type plain MSTeamsConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.WebhookURL == nil && c.WebhookURLFile == "" {
		return errors.New("one of webhook_url or webhook_url_file must be configured")
	}

	if c.WebhookURL != nil && len(c.WebhookURLFile) > 0 {
		return errors.New("at most one of webhook_url & webhook_url_file must be configured")
	}

	return nil
}

type MSTeamsV2Config struct {
	NotifierConfig `yaml:",inline" json:",inline"`
	HTTPConfig     *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`
	WebhookURL     *SecretURL                  `yaml:"webhook_url,omitempty" json:"webhook_url,omitempty"`
	WebhookURLFile string                      `yaml:"webhook_url_file,omitempty" json:"webhook_url_file,omitempty"`

	Title string `yaml:"title,omitempty" json:"title,omitempty"`
	Text  string `yaml:"text,omitempty" json:"text,omitempty"`
}

func (c *MSTeamsV2Config) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultMSTeamsV2Config
	type plain MSTeamsV2Config
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.WebhookURL == nil && c.WebhookURLFile == "" {
		return errors.New("one of webhook_url or webhook_url_file must be configured")
	}

	if c.WebhookURL != nil && len(c.WebhookURLFile) > 0 {
		return errors.New("at most one of webhook_url & webhook_url_file must be configured")
	}

	return nil
}

type JiraConfig struct {
	NotifierConfig `yaml:",inline" json:",inline"`
	HTTPConfig     *commoncfg.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`

	APIURL *URL `yaml:"api_url,omitempty" json:"api_url,omitempty"`

	Project     string   `yaml:"project,omitempty" json:"project,omitempty"`
	Summary     string   `yaml:"summary,omitempty" json:"summary,omitempty"`
	Description string   `yaml:"description,omitempty" json:"description,omitempty"`
	Labels      []string `yaml:"labels,omitempty" json:"labels,omitempty"`
	Priority    string   `yaml:"priority,omitempty" json:"priority,omitempty"`
	IssueType   string   `yaml:"issue_type,omitempty" json:"issue_type,omitempty"`

	ReopenTransition  string         `yaml:"reopen_transition,omitempty" json:"reopen_transition,omitempty"`
	ResolveTransition string         `yaml:"resolve_transition,omitempty" json:"resolve_transition,omitempty"`
	WontFixResolution string         `yaml:"wont_fix_resolution,omitempty" json:"wont_fix_resolution,omitempty"`
	ReopenDuration    model.Duration `yaml:"reopen_duration,omitempty" json:"reopen_duration,omitempty"`

	Fields map[string]any `yaml:"fields,omitempty" json:"custom_fields,omitempty"`
}

func (c *JiraConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultJiraConfig
	type plain JiraConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	if c.Project == "" {
		return errors.New("missing project in jira_config")
	}
	if c.IssueType == "" {
		return errors.New("missing issue_type in jira_config")
	}

	return nil
}
