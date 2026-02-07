package notifytest

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/grafana/alerting/http"
	"github.com/grafana/alerting/models"
	"github.com/grafana/alerting/receivers/alertmanager"
	alertmanagerv1 "github.com/grafana/alerting/receivers/alertmanager/v1"
	"github.com/grafana/alerting/receivers/dingding"
	dingdingv1 "github.com/grafana/alerting/receivers/dingding/v1"
	"github.com/grafana/alerting/receivers/discord"
	discordv1 "github.com/grafana/alerting/receivers/discord/v1"
	"github.com/grafana/alerting/receivers/email"
	emailv1 "github.com/grafana/alerting/receivers/email/v1"
	"github.com/grafana/alerting/receivers/googlechat"
	googlechatv1 "github.com/grafana/alerting/receivers/googlechat/v1"
	"github.com/grafana/alerting/receivers/jira"
	jirav1 "github.com/grafana/alerting/receivers/jira/v1"
	"github.com/grafana/alerting/receivers/kafka"
	kafkav1 "github.com/grafana/alerting/receivers/kafka/v1"
	"github.com/grafana/alerting/receivers/line"
	linev1 "github.com/grafana/alerting/receivers/line/v1"
	"github.com/grafana/alerting/receivers/mqtt"
	mqttv1 "github.com/grafana/alerting/receivers/mqtt/v1"
	"github.com/grafana/alerting/receivers/oncall"
	oncallv1 "github.com/grafana/alerting/receivers/oncall/v1"
	"github.com/grafana/alerting/receivers/opsgenie"
	opsgeniev1 "github.com/grafana/alerting/receivers/opsgenie/v1"
	"github.com/grafana/alerting/receivers/pagerduty"
	pagerdutyv1 "github.com/grafana/alerting/receivers/pagerduty/v1"
	"github.com/grafana/alerting/receivers/pushover"
	pushoverv1 "github.com/grafana/alerting/receivers/pushover/v1"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/sensugo"
	sensugov1 "github.com/grafana/alerting/receivers/sensugo/v1"
	"github.com/grafana/alerting/receivers/slack"
	slackv1 "github.com/grafana/alerting/receivers/slack/v1"
	"github.com/grafana/alerting/receivers/sns"
	snsv1 "github.com/grafana/alerting/receivers/sns/v1"
	"github.com/grafana/alerting/receivers/teams"
	teamsv1 "github.com/grafana/alerting/receivers/teams/v1"
	"github.com/grafana/alerting/receivers/telegram"
	telegramv1 "github.com/grafana/alerting/receivers/telegram/v1"
	"github.com/grafana/alerting/receivers/threema"
	threemav1 "github.com/grafana/alerting/receivers/threema/v1"
	"github.com/grafana/alerting/receivers/victorops"
	victoropsv1 "github.com/grafana/alerting/receivers/victorops/v1"
	"github.com/grafana/alerting/receivers/webex"
	webexv1 "github.com/grafana/alerting/receivers/webex/v1"
	"github.com/grafana/alerting/receivers/webhook"
	webhookv1 "github.com/grafana/alerting/receivers/webhook/v1"
	"github.com/grafana/alerting/receivers/wecom"
	wecomv1 "github.com/grafana/alerting/receivers/wecom/v1"
)

var AllKnownV1ConfigsForTesting = map[schema.IntegrationType]NotifierConfigTest{
	alertmanager.Type: {
		NotifierType:                alertmanager.Type,
		Version:                     schema.V1,
		Config:                      alertmanagerv1.FullValidConfigForTesting,
		Secrets:                     alertmanagerv1.FullValidSecretsForTesting,
		CommonHTTPConfigUnsupported: true,
	},
	dingding.Type: {
		NotifierType: dingding.Type,
		Version:      schema.V1,
		Config:       dingdingv1.FullValidConfigForTesting,
	},
	discord.Type: {
		NotifierType: discord.Type,
		Version:      schema.V1,
		Config:       discordv1.FullValidConfigForTesting,
	},
	email.Type: {
		NotifierType:                email.Type,
		Version:                     schema.V1,
		Config:                      emailv1.FullValidConfigForTesting,
		CommonHTTPConfigUnsupported: true,
	},
	googlechat.Type: {
		NotifierType: googlechat.Type,
		Version:      schema.V1,
		Config:       googlechatv1.FullValidConfigForTesting,
		Secrets:      googlechatv1.FullValidSecretsForTesting,
	},
	jira.Type: {
		NotifierType: jira.Type,
		Version:      schema.V1,
		Config:       jirav1.FullValidConfigForTesting,
		Secrets:      jirav1.FullValidSecretsForTesting,
	},
	kafka.Type: {
		NotifierType: kafka.Type,
		Version:      schema.V1,
		Config:       kafkav1.FullValidConfigForTesting,
		Secrets:      kafkav1.FullValidSecretsForTesting,
	},
	line.Type: {
		NotifierType: line.Type,
		Version:      schema.V1,
		Config:       linev1.FullValidConfigForTesting,
		Secrets:      linev1.FullValidSecretsForTesting,
	},
	mqtt.Type: {
		NotifierType:                mqtt.Type,
		Version:                     schema.V1,
		Config:                      mqttv1.FullValidConfigForTesting,
		Secrets:                     mqttv1.FullValidSecretsForTesting,
		CommonHTTPConfigUnsupported: true,
	},
	oncall.Type: {
		NotifierType: oncall.Type,
		Version:      schema.V1,
		Config:       oncallv1.FullValidConfigForTesting,
		Secrets:      oncallv1.FullValidSecretsForTesting,
	},
	opsgenie.Type: {
		NotifierType: opsgenie.Type,
		Version:      schema.V1,
		Config:       opsgeniev1.FullValidConfigForTesting,
		Secrets:      opsgeniev1.FullValidSecretsForTesting,
	},
	pagerduty.Type: {
		NotifierType: pagerduty.Type,
		Version:      schema.V1,
		Config:       pagerdutyv1.FullValidConfigForTesting,
		Secrets:      pagerdutyv1.FullValidSecretsForTesting,
	},
	pushover.Type: {
		NotifierType: pushover.Type,
		Version:      schema.V1,
		Config:       pushoverv1.FullValidConfigForTesting,
		Secrets:      pushoverv1.FullValidSecretsForTesting,
	},
	sensugo.Type: {
		NotifierType: sensugo.Type,
		Version:      schema.V1,
		Config:       sensugov1.FullValidConfigForTesting,
		Secrets:      sensugov1.FullValidSecretsForTesting,
	},
	slack.Type: {
		NotifierType:                slack.Type,
		Version:                     schema.V1,
		Config:                      slackv1.FullValidConfigForTesting,
		Secrets:                     slackv1.FullValidSecretsForTesting,
		CommonHTTPConfigUnsupported: true,
	},
	sns.Type: {
		NotifierType:                sns.Type,
		Version:                     schema.V1,
		Config:                      snsv1.FullValidConfigForTesting,
		CommonHTTPConfigUnsupported: true,
	},
	teams.Type: {
		NotifierType: teams.Type,
		Version:      schema.V1,
		Config:       teamsv1.FullValidConfigForTesting,
	},
	telegram.Type: {
		NotifierType: telegram.Type,
		Version:      schema.V1,
		Config:       telegramv1.FullValidConfigForTesting,
		Secrets:      telegramv1.FullValidSecretsForTesting,
	},
	threema.Type: {
		NotifierType: threema.Type,
		Version:      schema.V1,
		Config:       threemav1.FullValidConfigForTesting,
		Secrets:      threemav1.FullValidSecretsForTesting,
	},
	victorops.Type: {
		NotifierType: victorops.Type,
		Version:      schema.V1,
		Config:       victoropsv1.FullValidConfigForTesting,
		Secrets:      victoropsv1.FullValidSecretsForTesting,
	},
	webhook.Type: {
		NotifierType: webhook.Type,
		Version:      schema.V1,
		Config:       webhookv1.FullValidConfigForTesting,
		Secrets:      webhookv1.FullValidSecretsForTesting,
	},
	wecom.Type: {
		NotifierType: wecom.Type,
		Version:      schema.V1,
		Config:       wecomv1.FullValidConfigForTesting,
		Secrets:      wecomv1.FullValidSecretsForTesting,
	},
	webex.Type: {
		NotifierType: webex.Type,
		Version:      schema.V1,
		Config:       webexv1.FullValidConfigForTesting,
		Secrets:      webexv1.FullValidSecretsForTesting,
	},
}

var FullValidHTTPConfigForTesting = fmt.Sprintf(`{
	"http_config": {
		"oauth2": {
			"client_id": "test-client-id",
			"client_secret": "test-client-secret",
			"token_url": "https://localhost/auth/token",
			"scopes": ["scope1", "scope2"],
			"endpoint_params": {
				"param1": "value1",
				"param2": "value2"
			},
			"tls_config": {
				"insecureSkipVerify": false,
				"clientCertificate": %[1]q,
				"clientKey": %[2]q,
				"caCertificate": %[3]q
			},
			"proxy_config": {
				"proxy_url": "http://localproxy:8080",
				"no_proxy": "localhost",
				"proxy_from_environment": false,
				"proxy_connect_header": {
					"X-Proxy-Header": "proxy-value"
				}
			}
		}
    }
}`, http.TestCertPem, http.TestKeyPem, http.TestCACert)

var FullValidHTTPConfigSecretsForTesting = fmt.Sprintf(`{
	"http_config.oauth2.client_secret": "test-override-oauth2-secret",
	"http_config.oauth2.tls_config.clientCertificate": %[1]q,
	"http_config.oauth2.tls_config.clientKey": %[2]q,
	"http_config.oauth2.tls_config.caCertificate": %[3]q
}`, http.TestCertPem, http.TestKeyPem, http.TestCACert)

type NotifierConfigTest struct {
	NotifierType                schema.IntegrationType
	Version                     schema.Version
	Config                      string
	Secrets                     string
	CommonHTTPConfigUnsupported bool
}

func (n NotifierConfigTest) GetRawNotifierConfig(name string) *models.IntegrationConfig {
	if name == "" {
		name = string(n.NotifierType)
	}
	secrets := make(map[string]string)
	if n.Secrets != "" {
		err := json.Unmarshal([]byte(n.Secrets), &secrets)
		if err != nil {
			panic(err)
		}
		for key, value := range secrets {
			secrets[key] = base64.StdEncoding.EncodeToString([]byte(value))
		}
	}

	config := []byte(n.Config)
	if !n.CommonHTTPConfigUnsupported {
		var err error
		config, err = mergeSettings([]byte(n.Config), []byte(FullValidHTTPConfigForTesting))
		if err != nil {
			panic(err)
		}
	}

	return &models.IntegrationConfig{
		UID:                   fmt.Sprintf("%s-uid", name),
		Name:                  name,
		Type:                  string(n.NotifierType),
		DisableResolveMessage: true,
		Settings:              config,
		SecureSettings:        secrets,
	}
}
