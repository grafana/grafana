package notify

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/http"
	"github.com/grafana/alerting/models"
	"github.com/grafana/alerting/receivers"
	alertmanager "github.com/grafana/alerting/receivers/alertmanager/v1"
	dingding "github.com/grafana/alerting/receivers/dingding/v1"
	discord "github.com/grafana/alerting/receivers/discord/v1"
	email "github.com/grafana/alerting/receivers/email/v1"
	googlechat "github.com/grafana/alerting/receivers/googlechat/v1"
	jira "github.com/grafana/alerting/receivers/jira/v1"
	kafka "github.com/grafana/alerting/receivers/kafka/v1"
	line "github.com/grafana/alerting/receivers/line/v1"
	mqtt "github.com/grafana/alerting/receivers/mqtt/v1"
	oncall "github.com/grafana/alerting/receivers/oncall/v1"
	opsgenie "github.com/grafana/alerting/receivers/opsgenie/v1"
	pagerduty "github.com/grafana/alerting/receivers/pagerduty/v1"
	pushover "github.com/grafana/alerting/receivers/pushover/v1"
	"github.com/grafana/alerting/receivers/schema"
	sensugo "github.com/grafana/alerting/receivers/sensugo/v1"
	slack "github.com/grafana/alerting/receivers/slack/v1"
	sns "github.com/grafana/alerting/receivers/sns/v1"
	teams "github.com/grafana/alerting/receivers/teams/v1"
	telegram "github.com/grafana/alerting/receivers/telegram/v1"
	threema "github.com/grafana/alerting/receivers/threema/v1"
	victorops "github.com/grafana/alerting/receivers/victorops/v1"
	webex "github.com/grafana/alerting/receivers/webex/v1"
	webhook "github.com/grafana/alerting/receivers/webhook/v1"
	wecom "github.com/grafana/alerting/receivers/wecom/v1"
)

const (
	maxTestReceiversWorkers = 10
)

var (
	ErrNoReceivers = errors.New("no receivers")
)

type TestReceiversResult struct {
	Alert     types.Alert          `json:"alert"`
	Receivers []TestReceiverResult `json:"receivers"`
	NotifedAt time.Time            `json:"notifiedAt"`
}

type TestReceiverResult struct {
	Name    string                        `json:"name"`
	Configs []TestIntegrationConfigResult `json:"configs"`
}

type TestIntegrationConfigResult struct {
	Name   string `json:"name"`
	UID    string `json:"uid"`
	Status string `json:"status"`
	Error  string `json:"error"`
}

type ConfigReceiver = config.Receiver

type APIReceiver struct {
	ConfigReceiver        `yaml:",inline"`
	models.ReceiverConfig `yaml:",inline"`
}

type TestReceiversConfigBodyParams struct {
	Alert     *models.TestReceiversConfigAlertParams `yaml:"alert,omitempty" json:"alert,omitempty"`
	Receivers []*APIReceiver                         `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type IntegrationTimeoutError struct {
	Integration *models.IntegrationConfig
	Err         error
}

func (e IntegrationTimeoutError) Error() string {
	return fmt.Sprintf("the receiver timed out: %s", e.Err)
}

func (am *GrafanaAlertmanager) TestReceivers(ctx context.Context, c TestReceiversConfigBodyParams) (*TestReceiversResult, int, error) {
	am.reloadConfigMtx.RLock()
	templates := am.templates
	am.reloadConfigMtx.RUnlock()

	return TestReceivers(ctx, c, am.buildReceiverIntegrations, templates)
}

func newTestAlert(c *models.TestReceiversConfigAlertParams, startsAt, updatedAt time.Time) types.Alert {
	var (
		defaultAnnotations = model.LabelSet{
			"summary":          "Notification test",
			"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]",
		}
		defaultLabels = model.LabelSet{
			"alertname": "TestAlert",
			"instance":  "Grafana",
		}
	)

	alert := types.Alert{
		Alert: model.Alert{
			Labels:      defaultLabels,
			Annotations: defaultAnnotations,
			StartsAt:    startsAt,
		},
		UpdatedAt: updatedAt,
	}

	if c == nil {
		return alert
	}
	if c.Annotations != nil {
		for k, v := range c.Annotations {
			alert.Annotations[k] = v
		}
	}
	if c.Labels != nil {
		for k, v := range c.Labels {
			alert.Labels[k] = v
		}
	}
	return alert
}

func ProcessIntegrationError(config *models.IntegrationConfig, err error) error {
	if err == nil {
		return nil
	}

	var urlError *url.Error
	if errors.As(err, &urlError) {
		if urlError.Timeout() {
			return IntegrationTimeoutError{
				Integration: config,
				Err:         err,
			}
		}
	}

	if errors.Is(err, context.DeadlineExceeded) {
		return IntegrationTimeoutError{
			Integration: config,
			Err:         err,
		}
	}

	return err
}

// GrafanaReceiverConfig represents a parsed and validated APIReceiver
type GrafanaReceiverConfig struct {
	Name                string
	AlertmanagerConfigs []*NotifierConfig[alertmanager.Config]
	DingdingConfigs     []*NotifierConfig[dingding.Config]
	DiscordConfigs      []*NotifierConfig[discord.Config]
	EmailConfigs        []*NotifierConfig[email.Config]
	GooglechatConfigs   []*NotifierConfig[googlechat.Config]
	JiraConfigs         []*NotifierConfig[jira.Config]
	KafkaConfigs        []*NotifierConfig[kafka.Config]
	LineConfigs         []*NotifierConfig[line.Config]
	OpsgenieConfigs     []*NotifierConfig[opsgenie.Config]
	MqttConfigs         []*NotifierConfig[mqtt.Config]
	PagerdutyConfigs    []*NotifierConfig[pagerduty.Config]
	OnCallConfigs       []*NotifierConfig[oncall.Config]
	PushoverConfigs     []*NotifierConfig[pushover.Config]
	SensugoConfigs      []*NotifierConfig[sensugo.Config]
	SlackConfigs        []*NotifierConfig[slack.Config]
	SNSConfigs          []*NotifierConfig[sns.Config]
	TeamsConfigs        []*NotifierConfig[teams.Config]
	TelegramConfigs     []*NotifierConfig[telegram.Config]
	ThreemaConfigs      []*NotifierConfig[threema.Config]
	VictoropsConfigs    []*NotifierConfig[victorops.Config]
	WebhookConfigs      []*NotifierConfig[webhook.Config]
	WecomConfigs        []*NotifierConfig[wecom.Config]
	WebexConfigs        []*NotifierConfig[webex.Config]
}

// NotifierConfig represents parsed IntegrationConfig.
type NotifierConfig[T interface{}] struct {
	receivers.Metadata
	Settings         T
	HTTPClientConfig *http.HTTPClientConfig
}

// DecodeSecretsFn is a function used to decode a map of secrets before creating a receiver.
type DecodeSecretsFn func(secrets map[string]string) (map[string][]byte, error)

// DecodeSecretsFromBase64 is a DecodeSecretsFn that base64-decodes a map of secrets.
func DecodeSecretsFromBase64(secrets map[string]string) (map[string][]byte, error) {
	secureSettings := make(map[string][]byte, len(secrets))
	if secrets == nil {
		return secureSettings, nil
	}
	for k, v := range secrets {
		d, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return nil, fmt.Errorf("failed to decode secure settings key %s: %w", k, err)
		}
		secureSettings[k] = d
	}
	return secureSettings, nil
}

// NoopDecode is a DecodeSecretsFn that converts a map[string]string into a map[string][]byte without decoding it.
func NoopDecode(secrets map[string]string) (map[string][]byte, error) {
	secureSettings := make(map[string][]byte, len(secrets))
	if secrets == nil {
		return secureSettings, nil
	}

	for k, v := range secrets {
		secureSettings[k] = []byte(v)
	}
	return secureSettings, nil
}

// GetDecryptedValueFn is a function that returns the decrypted value of
// the given key. If the key is not present, then it returns the fallback value.
type GetDecryptedValueFn func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string

// NoopDecrypt is a GetDecryptedValueFn that returns a value without decrypting it.
func NoopDecrypt(_ context.Context, sjd map[string][]byte, key string, fallback string) string {
	if v, ok := sjd[key]; ok {
		return string(v)
	}
	return fallback
}

// BuildReceiverConfiguration parses, decrypts and validates the APIReceiver.
func BuildReceiverConfiguration(ctx context.Context, api *APIReceiver, decode DecodeSecretsFn, decrypt GetDecryptedValueFn) (GrafanaReceiverConfig, error) {
	result := GrafanaReceiverConfig{
		Name: api.Name,
	}
	for i, receiver := range api.Integrations {
		err := parseNotifier(ctx, &result, receiver, decode, decrypt, i)
		if err != nil {
			return GrafanaReceiverConfig{}, IntegrationValidationError{
				Integration: receiver,
				Err:         err,
			}
		}
	}
	return result, nil
}

// parseNotifier parses receivers and populates the corresponding field in GrafanaReceiverConfig. Returns an error if the configuration cannot be parsed.
func parseNotifier(ctx context.Context, result *GrafanaReceiverConfig, receiver *models.IntegrationConfig, decode DecodeSecretsFn, decrypt GetDecryptedValueFn, idx int) error {
	secureSettings, err := decode(receiver.SecureSettings)
	if err != nil {
		return err
	}

	decryptFn := func(key string, fallback string) string {
		return decrypt(ctx, secureSettings, key, fallback)
	}

	switch strings.ToLower(receiver.Type) {
	case "prometheus-alertmanager":
		cfg, err := alertmanager.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.AlertmanagerConfigs = append(result.AlertmanagerConfigs, notifierConfig)
	case "dingding":
		cfg, err := dingding.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.DingdingConfigs = append(result.DingdingConfigs, notifierConfig)
	case "discord":
		cfg, err := discord.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.DiscordConfigs = append(result.DiscordConfigs, notifierConfig)
	case "email":
		cfg, err := email.NewConfig(receiver.Settings)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.EmailConfigs = append(result.EmailConfigs, notifierConfig)
	case "googlechat":
		cfg, err := googlechat.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.GooglechatConfigs = append(result.GooglechatConfigs, notifierConfig)
	case "jira":
		cfg, err := jira.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.JiraConfigs = append(result.JiraConfigs, notifierConfig)
	case "kafka":
		cfg, err := kafka.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.KafkaConfigs = append(result.KafkaConfigs, notifierConfig)
	case "line":
		cfg, err := line.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.LineConfigs = append(result.LineConfigs, notifierConfig)
	case "mqtt":
		cfg, err := mqtt.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.MqttConfigs = append(result.MqttConfigs, notifierConfig)
	case "opsgenie":
		cfg, err := opsgenie.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.OpsgenieConfigs = append(result.OpsgenieConfigs, notifierConfig)
	case "pagerduty":
		cfg, err := pagerduty.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.PagerdutyConfigs = append(result.PagerdutyConfigs, notifierConfig)
	case "oncall":
		cfg, err := oncall.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.OnCallConfigs = append(result.OnCallConfigs, notifierConfig)
	case "pushover":
		cfg, err := pushover.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.PushoverConfigs = append(result.PushoverConfigs, notifierConfig)
	case "sensugo":
		cfg, err := sensugo.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.SensugoConfigs = append(result.SensugoConfigs, notifierConfig)
	case "slack":
		cfg, err := slack.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.SlackConfigs = append(result.SlackConfigs, notifierConfig)
	case "sns":
		cfg, err := sns.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.SNSConfigs = append(result.SNSConfigs, notifierConfig)
	case "teams":
		cfg, err := teams.NewConfig(receiver.Settings)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.TeamsConfigs = append(result.TeamsConfigs, notifierConfig)
	case "telegram":
		cfg, err := telegram.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.TelegramConfigs = append(result.TelegramConfigs, notifierConfig)
	case "threema":
		cfg, err := threema.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.ThreemaConfigs = append(result.ThreemaConfigs, notifierConfig)
	case "victorops":
		cfg, err := victorops.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.VictoropsConfigs = append(result.VictoropsConfigs, notifierConfig)
	case "webhook":
		cfg, err := webhook.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.WebhookConfigs = append(result.WebhookConfigs, notifierConfig)
	case "wecom":
		cfg, err := wecom.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.WecomConfigs = append(result.WecomConfigs, notifierConfig)
	case "webex":
		cfg, err := webex.NewConfig(receiver.Settings, decryptFn)
		if err != nil {
			return err
		}
		notifierConfig, err := newNotifierConfig(receiver, idx, cfg, decryptFn)
		if err != nil {
			return err
		}
		result.WebexConfigs = append(result.WebexConfigs, notifierConfig)
	default:
		return fmt.Errorf("notifier %s is not supported", receiver.Type)
	}
	return nil
}

// GetActiveReceiversMap returns all receivers that are in use by a route.
func GetActiveReceiversMap(r *dispatch.Route) map[string]struct{} {
	receiversMap := make(map[string]struct{})
	visitFunc := func(r *dispatch.Route) {
		receiversMap[r.RouteOpts.Receiver] = struct{}{}
	}
	r.Walk(visitFunc)

	return receiversMap
}

func parseHTTPConfig(integration *models.IntegrationConfig, decryptFn func(key string, fallback string) string) (*http.HTTPClientConfig, error) {
	httpConfigSettings := struct {
		HTTPConfig *http.HTTPClientConfig `yaml:"http_config,omitempty" json:"http_config,omitempty"`
	}{}
	if err := json.Unmarshal(integration.Settings, &httpConfigSettings); err != nil {
		return nil, fmt.Errorf("failed to unmarshal http_config settings: %w", err)
	}

	if httpConfigSettings.HTTPConfig == nil {
		return nil, nil
	}

	httpConfigSettings.HTTPConfig.Decrypt(decryptFn)
	if err := http.ValidateHTTPClientConfig(httpConfigSettings.HTTPConfig); err != nil {
		return nil, fmt.Errorf("invalid HTTP client configuration: %w", err)
	}
	return httpConfigSettings.HTTPConfig, nil
}

func newNotifierConfig[T interface{}](integration *models.IntegrationConfig, idx int, settings T, decryptFn func(key string, fallback string) string) (*NotifierConfig[T], error) {
	httpClientConfig, err := parseHTTPConfig(integration, decryptFn)
	if err != nil {
		return nil, err
	}
	return &NotifierConfig[T]{
		Metadata: receivers.Metadata{
			Index:                 idx,
			UID:                   integration.UID,
			Name:                  integration.Name,
			Type:                  integration.Type,
			DisableResolveMessage: integration.DisableResolveMessage,
		},
		Settings:         settings,
		HTTPClientConfig: httpClientConfig,
	}, nil
}

type IntegrationValidationError struct {
	Err         error
	Integration *models.IntegrationConfig
}

func (e IntegrationValidationError) Error() string {
	name := ""
	if e.Integration.Name != "" {
		name = fmt.Sprintf("%q ", e.Integration.Name)
	}
	s := fmt.Sprintf("failed to validate integration %s(UID %s) of type %q: %s", name, e.Integration.UID, e.Integration.Type, e.Err.Error())
	return s
}

func (e IntegrationValidationError) Unwrap() error { return e.Err }

type MimirIntegrationConfig struct {
	Schema schema.IntegrationSchemaVersion
	Config any
}

// ConfigJSON returns the JSON representation of the integration config with non-masked secrets.
func (c MimirIntegrationConfig) ConfigJSON() ([]byte, error) {
	return definition.MarshalJSONWithSecrets(c.Config)
}

func (c MimirIntegrationConfig) ConfigMap() (map[string]any, error) {
	data, err := c.ConfigJSON()
	if err != nil {
		return nil, err
	}
	var result map[string]any
	err = json.Unmarshal(data, &result)
	if err != nil {
		return nil, err
	}
	return result, nil
}
