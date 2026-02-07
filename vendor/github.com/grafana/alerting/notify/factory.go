package notify

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	commoncfg "github.com/prometheus/common/config"

	promDiscord "github.com/prometheus/alertmanager/notify/discord"
	promEmail "github.com/prometheus/alertmanager/notify/email"
	promMSTeams "github.com/prometheus/alertmanager/notify/msteams"
	promMSTeamsV2 "github.com/prometheus/alertmanager/notify/msteamsv2"
	promOpsgenie "github.com/prometheus/alertmanager/notify/opsgenie"
	promPagerduty "github.com/prometheus/alertmanager/notify/pagerduty"
	promPushover "github.com/prometheus/alertmanager/notify/pushover"
	promSlack "github.com/prometheus/alertmanager/notify/slack"
	promSns "github.com/prometheus/alertmanager/notify/sns"
	promTelegram "github.com/prometheus/alertmanager/notify/telegram"
	promVictorops "github.com/prometheus/alertmanager/notify/victorops"
	promWebex "github.com/prometheus/alertmanager/notify/webex"
	promWebhook "github.com/prometheus/alertmanager/notify/webhook"
	promWechat "github.com/prometheus/alertmanager/notify/wechat"
	"github.com/prometheus/alertmanager/template"

	"github.com/grafana/alerting/http"
	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/notify/nfstatus"
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
	"github.com/grafana/alerting/templates"
)

type WrapNotifierFunc func(integrationName string, notifier notify.Notifier) notify.Notifier

var NoWrap WrapNotifierFunc = func(_ string, notifier notify.Notifier) notify.Notifier { return notifier }

// BuildGrafanaReceiverIntegrations creates integrations for each configured notification channel in GrafanaReceiverConfig.
// It returns a slice of Integration objects, one for each notification channel, along with any errors that occurred.
func BuildGrafanaReceiverIntegrations(
	receiver GrafanaReceiverConfig,
	tmpl *templates.Template,
	img images.Provider,
	logger log.Logger,
	emailSender receivers.EmailSender,
	wrapNotifier WrapNotifierFunc,
	orgID int64,
	version string,
	notificationHistorian nfstatus.NotificationHistorian,
	httpClientOptions ...http.ClientOption,
) ([]*Integration, error) {
	type notificationChannel interface {
		notify.Notifier
		notify.ResolvedSender
	}
	var (
		integrations []*Integration
		errs         error
		ci           = func(idx int, cfg receivers.Metadata, httpClientConfig *http.HTTPClientConfig, newInt func(cli *http.Client) notificationChannel) {
			client, err := http.NewClient(httpClientConfig, httpClientOptions...)
			if err != nil {
				errs = errors.Join(errs, fmt.Errorf("failed to create HTTP client for %q notifier %q (UID: %q): %w", cfg.Type, cfg.Name, cfg.UID, err))
				return
			}
			n := newInt(client)
			notify := wrapNotifier(cfg.Name, n)
			i := NewIntegration(notify, n, cfg.Type, idx, cfg.Name, notificationHistorian, logger)
			integrations = append(integrations, i)
		}
	)
	// Range through each notification channel in the receiver and create an integration for it.
	for i, cfg := range receiver.AlertmanagerConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(_ *http.Client) notificationChannel {
			return alertmanager.New(cfg.Settings, cfg.Metadata, img, logger)
		})
	}
	for i, cfg := range receiver.DingdingConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return dingding.New(cfg.Settings, cfg.Metadata, tmpl, cli, logger)
		})
	}
	for i, cfg := range receiver.DiscordConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return discord.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger, version)
		})
	}
	for i, cfg := range receiver.EmailConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(_ *http.Client) notificationChannel {
			return email.New(cfg.Settings, cfg.Metadata, tmpl, emailSender, img, logger)
		})
	}
	for i, cfg := range receiver.GooglechatConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return googlechat.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger, version)
		})
	}
	for i, cfg := range receiver.JiraConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return jira.New(cfg.Settings, cfg.Metadata, tmpl, http.NewForkedSender(cli), logger)
		})
	}
	for i, cfg := range receiver.KafkaConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return kafka.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.LineConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return line.New(cfg.Settings, cfg.Metadata, tmpl, cli, logger)
		})
	}
	for i, cfg := range receiver.MqttConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(_ *http.Client) notificationChannel {
			return mqtt.New(cfg.Settings, cfg.Metadata, tmpl, logger, nil)
		})
	}
	for i, cfg := range receiver.OnCallConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return oncall.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger, orgID)
		})
	}
	for i, cfg := range receiver.OpsgenieConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return opsgenie.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.PagerdutyConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return pagerduty.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.PushoverConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return pushover.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.SensugoConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return sensugo.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.SNSConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(_ *http.Client) notificationChannel {
			return sns.New(cfg.Settings, cfg.Metadata, tmpl, logger)
		})
	}
	for i, cfg := range receiver.SlackConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return slack.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger, version)
		})
	}
	for i, cfg := range receiver.TeamsConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return teams.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.TelegramConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return telegram.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.ThreemaConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return threema.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger)
		})
	}
	for i, cfg := range receiver.VictoropsConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return victorops.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger, version)
		})
	}
	for i, cfg := range receiver.WebhookConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return webhook.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger, orgID)
		})
	}
	for i, cfg := range receiver.WecomConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return wecom.New(cfg.Settings, cfg.Metadata, tmpl, cli, logger)
		})
	}
	for i, cfg := range receiver.WebexConfigs {
		ci(i, cfg.Metadata, cfg.HTTPClientConfig, func(cli *http.Client) notificationChannel {
			return webex.New(cfg.Settings, cfg.Metadata, tmpl, cli, img, logger, orgID)
		})
	}
	return integrations, errs
}

// BuildPrometheusReceiverIntegrations builds a list of integration notifiers off of a receiver config.
// Taken from https://github.com/grafana/mimir/blob/fa489e696481fe0b7b97598077565dc5027afa84/pkg/alertmanager/alertmanager.go#L754
// which is taken from https://github.com/prometheus/alertmanager/blob/94d875f1227b29abece661db1a68c001122d1da5/cmd/alertmanager/main.go#L112-L159.
func BuildPrometheusReceiverIntegrations(
	nc config.Receiver,
	tmplProvider TemplatesProvider,
	httpClientOptions []http.ClientOption,
	logger log.Logger,
	wrapper WrapNotifierFunc,
	notificationHistorian nfstatus.NotificationHistorian,
) ([]*nfstatus.Integration, error) {
	var (
		errs         types.MultiError
		integrations []*nfstatus.Integration
		tmpl         *template.Template
		httpOps      []commoncfg.HTTPClientOption
		initOnce     = sync.OnceFunc(func() { // lazy evaluate template so we do not create one if we don't need it
			httpOps = http.ToHTTPClientOption(httpClientOptions...)
			t, err := tmplProvider.GetTemplate(templates.MimirKind)
			if err != nil {
				errs.Add(err)
				return
			}
			tmpl = t.Template
		})
		add = func(name string, i int, rs notify.ResolvedSender, f func(l log.Logger) (notify.Notifier, error)) {
			initOnce()
			integrationLogger := log.With(logger, "integration", name)
			n, err := f(integrationLogger)
			if err != nil {
				errs.Add(err)
				return
			}
			if wrapper != nil {
				n = wrapper(name, n)
			}
			integrations = append(integrations, nfstatus.NewIntegration(n, rs, name, i, nc.Name, notificationHistorian, integrationLogger))
		}
	)

	for i, c := range nc.WebhookConfigs {
		add("webhook", i, c, func(l log.Logger) (notify.Notifier, error) { return promWebhook.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.EmailConfigs {
		add("email", i, c, func(l log.Logger) (notify.Notifier, error) { return promEmail.New(c, tmpl, l), nil })
	}
	for i, c := range nc.PagerdutyConfigs {
		add("pagerduty", i, c, func(l log.Logger) (notify.Notifier, error) { return promPagerduty.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.OpsGenieConfigs {
		add("opsgenie", i, c, func(l log.Logger) (notify.Notifier, error) { return promOpsgenie.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.WechatConfigs {
		add("wechat", i, c, func(l log.Logger) (notify.Notifier, error) { return promWechat.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.SlackConfigs {
		add("slack", i, c, func(l log.Logger) (notify.Notifier, error) { return promSlack.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.VictorOpsConfigs {
		add("victorops", i, c, func(l log.Logger) (notify.Notifier, error) { return promVictorops.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.PushoverConfigs {
		add("pushover", i, c, func(l log.Logger) (notify.Notifier, error) { return promPushover.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.SNSConfigs {
		add("sns", i, c, func(l log.Logger) (notify.Notifier, error) { return promSns.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.TelegramConfigs {
		add("telegram", i, c, func(l log.Logger) (notify.Notifier, error) { return promTelegram.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.DiscordConfigs {
		add("discord", i, c, func(l log.Logger) (notify.Notifier, error) { return promDiscord.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.WebexConfigs {
		add("webex", i, c, func(l log.Logger) (notify.Notifier, error) { return promWebex.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.MSTeamsConfigs {
		add("msteams", i, c, func(l log.Logger) (notify.Notifier, error) { return promMSTeams.New(c, tmpl, l, httpOps...) })
	}
	for i, c := range nc.MSTeamsV2Configs {
		add("msteamsv2", i, c, func(l log.Logger) (notify.Notifier, error) { return promMSTeamsV2.New(c, tmpl, l, httpOps...) })
	}
	// If we add support for more integrations, we need to add them to validation as well. See validation.allowedIntegrationNames field.
	if errs.Len() > 0 {
		return nil, &errs
	}
	return integrations, nil
}

// BuildReceiversIntegrations builds integrations for the provided API receivers and returns them mapped by receiver name.
// It ensures uniqueness of receivers by the name, overwriting duplicates and logs warnings.
// Returns an error if any integration fails during its construction.
func BuildReceiversIntegrations(
	tenantID int64,
	apiReceivers []*APIReceiver,
	templ TemplatesProvider,
	images images.Provider,
	decryptFn GetDecryptedValueFn,
	decodeFn DecodeSecretsFn,
	emailSender receivers.EmailSender,
	httpClientOptions []http.ClientOption,
	notifierFunc WrapNotifierFunc,
	version string,
	logger log.Logger,
	notificationHistorian nfstatus.NotificationHistorian,
) (map[string][]*Integration, error) {
	nameToReceiver := make(map[string]*APIReceiver, len(apiReceivers))
	for _, receiver := range apiReceivers {
		if existing, ok := nameToReceiver[receiver.Name]; ok {
			itypes := make([]string, 0, len(existing.Integrations))
			for _, i := range existing.Integrations {
				itypes = append(itypes, i.Type)
			}
			level.Warn(logger).Log("msg", "receiver with same name is defined multiple times. Only the last one will be used", "receiver_name", receiver.Name, "overwritten_integrations", itypes)
		}
		nameToReceiver[receiver.Name] = receiver
	}

	integrationsMap := make(map[string][]*Integration, len(apiReceivers))
	for name, apiReceiver := range nameToReceiver {
		integrations, err := BuildReceiverIntegrations(tenantID, apiReceiver, templ, images, decryptFn, decodeFn, emailSender, httpClientOptions, notifierFunc, version, logger, notificationHistorian)
		if err != nil {
			return nil, fmt.Errorf("failed to build receiver %s: %w", name, err)
		}
		integrationsMap[name] = integrations
	}
	return integrationsMap, nil
}

// BuildReceiverIntegrations builds integrations for the provided API receiver and returns them.
// It supports both Prometheus and Grafana integrations and ensures that both of them use only templates dedicated for the kind.
func BuildReceiverIntegrations(
	tenantID int64,
	receiver *APIReceiver,
	tmpls TemplatesProvider,
	images images.Provider,
	decryptFn GetDecryptedValueFn,
	decodeFn DecodeSecretsFn,
	emailSender receivers.EmailSender,
	httpClientOptions []http.ClientOption,
	wrapNotifierFunc WrapNotifierFunc,
	version string,
	logger log.Logger,
	notificationHistorian nfstatus.NotificationHistorian,
) ([]*Integration, error) {
	var integrations []*Integration
	if len(receiver.Integrations) > 0 {
		receiverCfg, err := BuildReceiverConfiguration(context.Background(), receiver, decodeFn, decryptFn)
		if err != nil {
			return nil, err
		}
		tmpl, err := tmpls.GetTemplate(templates.GrafanaKind)
		if err != nil {
			return nil, err
		}
		integrations, err = BuildGrafanaReceiverIntegrations(
			receiverCfg,
			tmpl,
			images,
			logger,
			emailSender,
			wrapNotifierFunc,
			tenantID,
			version,
			notificationHistorian,
			httpClientOptions...,
		)
		if err != nil {
			return nil, err
		}
	}
	mimir, err := BuildPrometheusReceiverIntegrations(receiver.ConfigReceiver, tmpls, httpClientOptions, logger, wrapNotifierFunc, notificationHistorian)
	if err != nil {
		return nil, err
	}
	integrations = append(integrations, mimir...)

	return integrations, nil
}
