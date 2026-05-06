package notify

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/alerting/http"
	"github.com/prometheus/alertmanager/types"

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
	receiversTesting "github.com/grafana/alerting/receivers/testing"
	"github.com/grafana/alerting/receivers/threema"
	"github.com/grafana/alerting/receivers/victorops"
	"github.com/grafana/alerting/receivers/webex"
	"github.com/grafana/alerting/receivers/webhook"
	"github.com/grafana/alerting/receivers/wecom"
	"github.com/grafana/alerting/templates"
)

func ptr[T any](v T) *T {
	return &v
}

func newFakeMaintanenceOptions(t *testing.T) *fakeMaintenanceOptions {
	t.Helper()

	return &fakeMaintenanceOptions{}
}

type fakeMaintenanceOptions struct {
}

func (f *fakeMaintenanceOptions) InitialState() string {
	return ""
}

func (f *fakeMaintenanceOptions) Retention() time.Duration {
	return 30 * time.Millisecond
}

func (f *fakeMaintenanceOptions) MaintenanceFrequency() time.Duration {
	return 15 * time.Millisecond
}

func (f *fakeMaintenanceOptions) MaintenanceFunc(_ State) (int64, error) {
	return 0, nil
}

type FakeConfig struct {
}

func (f *FakeConfig) DispatcherLimits() DispatcherLimits {
	panic("implement me")
}

func (f *FakeConfig) InhibitRules() []*InhibitRule {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) MuteTimeIntervals() []MuteTimeInterval {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) ReceiverIntegrations() (map[string][]Integration, error) {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) RoutingTree() *Route {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) Templates() *templates.Template {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) Hash() [16]byte {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) Raw() []byte {
	// TODO implement me
	panic("implement me")
}

type fakeNotifier struct{}

func (f *fakeNotifier) Notify(_ context.Context, _ ...*types.Alert) (bool, error) {
	return true, nil
}

func (f *fakeNotifier) SendResolved() bool {
	return true
}

func GetDecryptedValueFnForTesting(_ context.Context, sjd map[string][]byte, key string, fallback string) string {
	return receiversTesting.DecryptForTesting(sjd)(key, fallback)
}

var AllKnownConfigsForTesting = map[string]NotifierConfigTest{
	"prometheus-alertmanager": {
		NotifierType:                "prometheus-alertmanager",
		Config:                      alertmanager.FullValidConfigForTesting,
		Secrets:                     alertmanager.FullValidSecretsForTesting,
		commonHTTPConfigUnsupported: true,
	},
	"dingding": {NotifierType: "dingding",
		Config: dinding.FullValidConfigForTesting,
	},
	"discord": {NotifierType: "discord",
		Config: discord.FullValidConfigForTesting,
	},
	"email": {NotifierType: "email",
		Config:                      email.FullValidConfigForTesting,
		commonHTTPConfigUnsupported: true,
	},
	"googlechat": {NotifierType: "googlechat",
		Config:  googlechat.FullValidConfigForTesting,
		Secrets: googlechat.FullValidSecretsForTesting,
	},
	"jira": {NotifierType: "jira",
		Config:  jira.FullValidConfigForTesting,
		Secrets: jira.FullValidSecretsForTesting,
	},
	"kafka": {NotifierType: "kafka",
		Config:  kafka.FullValidConfigForTesting,
		Secrets: kafka.FullValidSecretsForTesting,
	},
	"line": {NotifierType: "line",
		Config:  line.FullValidConfigForTesting,
		Secrets: line.FullValidSecretsForTesting,
	},
	"mqtt": {NotifierType: "mqtt",
		Config:                      mqtt.FullValidConfigForTesting,
		Secrets:                     mqtt.FullValidSecretsForTesting,
		commonHTTPConfigUnsupported: true,
	},
	"oncall": {NotifierType: "oncall",
		Config:  oncall.FullValidConfigForTesting,
		Secrets: oncall.FullValidSecretsForTesting,
	},
	"opsgenie": {NotifierType: "opsgenie",
		Config:  opsgenie.FullValidConfigForTesting,
		Secrets: opsgenie.FullValidSecretsForTesting,
	},
	"pagerduty": {NotifierType: "pagerduty",
		Config:  pagerduty.FullValidConfigForTesting,
		Secrets: pagerduty.FullValidSecretsForTesting,
	},
	"pushover": {NotifierType: "pushover",
		Config:  pushover.FullValidConfigForTesting,
		Secrets: pushover.FullValidSecretsForTesting,
	},
	"sensugo": {NotifierType: "sensugo",
		Config:  sensugo.FullValidConfigForTesting,
		Secrets: sensugo.FullValidSecretsForTesting,
	},
	"slack": {NotifierType: "slack",
		Config:                      slack.FullValidConfigForTesting,
		Secrets:                     slack.FullValidSecretsForTesting,
		commonHTTPConfigUnsupported: true,
	},
	"sns": {NotifierType: "sns",
		Config:                      sns.FullValidConfigForTesting,
		commonHTTPConfigUnsupported: true,
	},
	"teams": {NotifierType: "teams",
		Config: teams.FullValidConfigForTesting,
	},
	"telegram": {NotifierType: "telegram",
		Config:  telegram.FullValidConfigForTesting,
		Secrets: telegram.FullValidSecretsForTesting,
	},
	"threema": {NotifierType: "threema",
		Config:  threema.FullValidConfigForTesting,
		Secrets: threema.FullValidSecretsForTesting,
	},
	"victorops": {NotifierType: "victorops",
		Config:  victorops.FullValidConfigForTesting,
		Secrets: victorops.FullValidSecretsForTesting,
	},
	"webhook": {NotifierType: "webhook",
		Config:  webhook.FullValidConfigForTesting,
		Secrets: webhook.FullValidSecretsForTesting,
	},
	"wecom": {NotifierType: "wecom",
		Config:  wecom.FullValidConfigForTesting,
		Secrets: wecom.FullValidSecretsForTesting,
	},
	"webex": {NotifierType: "webex",
		Config:  webex.FullValidConfigForTesting,
		Secrets: webex.FullValidSecretsForTesting,
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
	NotifierType                string
	Config                      string
	Secrets                     string
	commonHTTPConfigUnsupported bool
}

func (n NotifierConfigTest) GetRawNotifierConfig(name string) *GrafanaIntegrationConfig {
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
	if !n.commonHTTPConfigUnsupported {
		var err error
		config, err = MergeSettings([]byte(n.Config), []byte(FullValidHTTPConfigForTesting))
		if err != nil {
			panic(err)
		}
	}

	return &GrafanaIntegrationConfig{
		UID:                   fmt.Sprintf("%s-uid", name),
		Name:                  name,
		Type:                  n.NotifierType,
		DisableResolveMessage: true,
		Settings:              json.RawMessage(config),
		SecureSettings:        secrets,
	}
}

func MergeSettings(a []byte, b []byte) ([]byte, error) {
	var origSettings map[string]any
	err := json.Unmarshal(a, &origSettings)
	if err != nil {
		return nil, err
	}
	var newSettings map[string]any
	err = json.Unmarshal(b, &newSettings)
	if err != nil {
		return nil, err
	}

	for key, value := range newSettings {
		origSettings[key] = value
	}

	return json.Marshal(origSettings)
}
