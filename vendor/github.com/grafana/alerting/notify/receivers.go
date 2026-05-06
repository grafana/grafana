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

	"github.com/grafana/alerting/http"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/alertmanager"
	"github.com/grafana/alerting/receivers/dinding"
	"github.com/grafana/alerting/receivers/discord"
	"github.com/grafana/alerting/receivers/email"
	"github.com/grafana/alerting/receivers/googlechat"
	"github.com/grafana/alerting/receivers/jira"
	"github.com/grafana/alerting/receivers/kafka"
	"github.com/grafana/alerting/receivers/line"
	"github.com/grafana/alerting/receivers/mqtt"
	"github.com/grafana/alerting/receivers/oncall"
	"github.com/grafana/alerting/receivers/opsgenie"
	"github.com/grafana/alerting/receivers/pagerduty"
	"github.com/grafana/alerting/receivers/pushover"
	"github.com/grafana/alerting/receivers/sensugo"
	"github.com/grafana/alerting/receivers/slack"
	"github.com/grafana/alerting/receivers/sns"
	"github.com/grafana/alerting/receivers/teams"
	"github.com/grafana/alerting/receivers/telegram"
	"github.com/grafana/alerting/receivers/threema"
	"github.com/grafana/alerting/receivers/victorops"
	"github.com/grafana/alerting/receivers/webex"
	"github.com/grafana/alerting/receivers/webhook"
	"github.com/grafana/alerting/receivers/wecom"
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

type GrafanaIntegrationConfig struct {
	UID                   string            `json:"uid" yaml:"uid"`
	Name                  string            `json:"name" yaml:"name"`
	Type                  string            `json:"type" yaml:"type"`
	DisableResolveMessage bool              `json:"disableResolveMessage" yaml:"disableResolveMessage"`
	Settings              json.RawMessage   `json:"settings" yaml:"settings"`
	SecureSettings        map[string]string `json:"secureSettings" yaml:"secureSettings"`
}

type ConfigReceiver = config.Receiver

type APIReceiver struct {
	ConfigReceiver      `yaml:",inline"`
	GrafanaIntegrations `yaml:",inline"`
}

type GrafanaIntegrations struct {
	Integrations []*GrafanaIntegrationConfig `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}

type TestReceiversConfigBodyParams struct {
	Alert     *TestReceiversConfigAlertParams `yaml:"alert,omitempty" json:"alert,omitempty"`
	Receivers []*APIReceiver                  `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type TestReceiversConfigAlertParams struct {
	Annotations model.LabelSet `yaml:"annotations,omitempty" json:"annotations,omitempty"`
	Labels      model.LabelSet `yaml:"labels,omitempty" json:"labels,omitempty"`
}

type IntegrationTimeoutError struct {
	Integration *GrafanaIntegrationConfig
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

func newTestAlert(c TestReceiversConfigBodyParams, startsAt, updatedAt time.Time) types.Alert {
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

	if c.Alert != nil {
		if c.Alert.Annotations != nil {
			for k, v := range c.Alert.Annotations {
				alert.Annotations[k] = v
			}
		}
		if c.Alert.Labels != nil {
			for k, v := range c.Alert.Labels {
				alert.Labels[k] = v
			}
		}
	}

	return alert
}

func ProcessIntegrationError(config *GrafanaIntegrationConfig, err error) error {
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
	DingdingConfigs     []*NotifierConfig[dinding.Config]
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

// NotifierConfig represents parsed GrafanaIntegrationConfig.
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
func parseNotifier(ctx context.Context, result *GrafanaReceiverConfig, receiver *GrafanaIntegrationConfig, decode DecodeSecretsFn, decrypt GetDecryptedValueFn, idx int) error {
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
		cfg, err := dinding.NewConfig(receiver.Settings)
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

func parseHTTPConfig(integration *GrafanaIntegrationConfig, decryptFn func(key string, fallback string) string) (*http.HTTPClientConfig, error) {
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

func newNotifierConfig[T interface{}](integration *GrafanaIntegrationConfig, idx int, settings T, decryptFn func(key string, fallback string) string) (*NotifierConfig[T], error) {
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
	Integration *GrafanaIntegrationConfig
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
