package definition

import (
	"errors"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/prometheus/alertmanager/config"
)

// LoadCompat loads a PostableApiAlertingConfig from a YAML configuration
// and runs validations to ensure that it works with the Mimir Alertmanager.
func LoadCompat(rawCfg []byte) (*PostableApiAlertingConfig, error) {
	if len(rawCfg) == 0 {
		return nil, errors.New("empty input")
	}

	var c PostableApiAlertingConfig
	if err := yaml.Unmarshal(rawCfg, &c); err != nil {
		return nil, err
	}

	// Having a nil global config causes panics in the Alertmanager codebase.
	if c.Global == nil {
		c.Global = &config.GlobalConfig{}
		*c.Global = config.DefaultGlobalConfig()
	}

	// Check that the configuration for upstream receivers is well formed.
	// Taken from https://github.com/prometheus/alertmanager/blob/3e70148d4f55a27b0c817d0997149bff30f6343e/config/config.go#L404-L637
	// with some modifications to ignore file-related settings and exclude RocketChat (not supported yet.
	names := map[string]struct{}{}
	for _, rcv := range c.Receivers {
		if _, ok := names[rcv.Name]; ok {
			return nil, fmt.Errorf("notification config name %q is not unique", rcv.Name)
		}
		for _, wh := range rcv.WebhookConfigs {
			if wh.HTTPConfig == nil {
				wh.HTTPConfig = c.Global.HTTPConfig
			}
		}
		for _, ec := range rcv.EmailConfigs {
			if ec.Smarthost.String() == "" {
				if c.Global.SMTPSmarthost.String() == "" {
					return nil, errors.New("no global SMTP smarthost set")
				}
				ec.Smarthost = c.Global.SMTPSmarthost
			}
			if ec.From == "" {
				if c.Global.SMTPFrom == "" {
					return nil, errors.New("no global SMTP from set")
				}
				ec.From = c.Global.SMTPFrom
			}
			if ec.Hello == "" {
				ec.Hello = c.Global.SMTPHello
			}
			if ec.AuthUsername == "" {
				ec.AuthUsername = c.Global.SMTPAuthUsername
			}
			if ec.AuthPassword == "" {
				ec.AuthPassword = c.Global.SMTPAuthPassword
			}
			if ec.AuthSecret == "" {
				ec.AuthSecret = c.Global.SMTPAuthSecret
			}
			if ec.AuthIdentity == "" {
				ec.AuthIdentity = c.Global.SMTPAuthIdentity
			}
			if ec.RequireTLS == nil {
				ec.RequireTLS = new(bool)
				*ec.RequireTLS = c.Global.SMTPRequireTLS
			}
		}
		for _, sc := range rcv.SlackConfigs {
			if sc.HTTPConfig == nil {
				sc.HTTPConfig = c.Global.HTTPConfig
			}
			if sc.APIURL == nil {
				if c.Global.SlackAPIURL == nil {
					return nil, errors.New("no global Slack API URL set")
				}
				sc.APIURL = c.Global.SlackAPIURL
			}
		}
		for _, poc := range rcv.PushoverConfigs {
			if poc.HTTPConfig == nil {
				poc.HTTPConfig = c.Global.HTTPConfig
			}
		}
		for _, pdc := range rcv.PagerdutyConfigs {
			if pdc.HTTPConfig == nil {
				pdc.HTTPConfig = c.Global.HTTPConfig
			}
			if pdc.URL == nil {
				if c.Global.PagerdutyURL == nil {
					return nil, errors.New("no global PagerDuty URL set")
				}
				pdc.URL = c.Global.PagerdutyURL
			}
		}
		for _, ogc := range rcv.OpsGenieConfigs {
			if ogc.HTTPConfig == nil {
				ogc.HTTPConfig = c.Global.HTTPConfig
			}
			if ogc.APIURL == nil {
				if c.Global.OpsGenieAPIURL == nil {
					return nil, errors.New("no global OpsGenie URL set")
				}
				ogc.APIURL = c.Global.OpsGenieAPIURL
			}
			if !strings.HasSuffix(ogc.APIURL.Path, "/") {
				ogc.APIURL.Path += "/"
			}
			if ogc.APIKey == "" {
				if c.Global.OpsGenieAPIKey == "" {
					return nil, errors.New("no global OpsGenie API Key set")
				}
				ogc.APIKey = c.Global.OpsGenieAPIKey
			}
		}
		for _, wcc := range rcv.WechatConfigs {
			if wcc.HTTPConfig == nil {
				wcc.HTTPConfig = c.Global.HTTPConfig
			}

			if wcc.APIURL == nil {
				if c.Global.WeChatAPIURL == nil {
					return nil, errors.New("no global Wechat URL set")
				}
				wcc.APIURL = c.Global.WeChatAPIURL
			}

			if wcc.APISecret == "" {
				if c.Global.WeChatAPISecret == "" {
					return nil, errors.New("no global Wechat ApiSecret set")
				}
				wcc.APISecret = c.Global.WeChatAPISecret
			}

			if wcc.CorpID == "" {
				if c.Global.WeChatAPICorpID == "" {
					return nil, errors.New("no global Wechat CorpID set")
				}
				wcc.CorpID = c.Global.WeChatAPICorpID
			}

			if !strings.HasSuffix(wcc.APIURL.Path, "/") {
				wcc.APIURL.Path += "/"
			}
		}
		for _, voc := range rcv.VictorOpsConfigs {
			if voc.HTTPConfig == nil {
				voc.HTTPConfig = c.Global.HTTPConfig
			}
			if voc.APIURL == nil {
				if c.Global.VictorOpsAPIURL == nil {
					return nil, errors.New("no global VictorOps URL set")
				}
				voc.APIURL = c.Global.VictorOpsAPIURL
			}
			if !strings.HasSuffix(voc.APIURL.Path, "/") {
				voc.APIURL.Path += "/"
			}
			if voc.APIKey == "" {
				if c.Global.VictorOpsAPIKey == "" {
					return nil, errors.New("no global VictorOps API Key set")
				}
				voc.APIKey = c.Global.VictorOpsAPIKey
			}
		}
		for _, sns := range rcv.SNSConfigs {
			if sns.HTTPConfig == nil {
				sns.HTTPConfig = c.Global.HTTPConfig
			}
		}

		for _, telegram := range rcv.TelegramConfigs {
			if telegram.HTTPConfig == nil {
				telegram.HTTPConfig = c.Global.HTTPConfig
			}
			if telegram.APIUrl == nil {
				telegram.APIUrl = c.Global.TelegramAPIUrl
			}
		}
		for _, discord := range rcv.DiscordConfigs {
			if discord.HTTPConfig == nil {
				discord.HTTPConfig = c.Global.HTTPConfig
			}
			if discord.WebhookURL == nil {
				return nil, errors.New("no discord webhook URL provided")
			}
		}
		for _, webex := range rcv.WebexConfigs {
			if webex.APIURL == nil {
				if c.Global.WebexAPIURL == nil {
					return nil, errors.New("no global Webex URL set")
				}

				webex.APIURL = c.Global.WebexAPIURL
			}
		}
		for _, msteams := range rcv.MSTeamsConfigs {
			if msteams.HTTPConfig == nil {
				msteams.HTTPConfig = c.Global.HTTPConfig
			}
			if msteams.WebhookURL == nil {
				return nil, errors.New("no msteams webhook URL provided")
			}
		}
		for _, msteamsv2 := range rcv.MSTeamsV2Configs {
			if msteamsv2.HTTPConfig == nil {
				msteamsv2.HTTPConfig = c.Global.HTTPConfig
			}
			if msteamsv2.WebhookURL == nil && len(msteamsv2.WebhookURLFile) == 0 {
				return nil, errors.New("no msteamsv2 webhook URL provided")
			}
		}
		for _, jira := range rcv.JiraConfigs {
			if jira.HTTPConfig == nil {
				jira.HTTPConfig = c.Global.HTTPConfig
			}
			if jira.APIURL == nil {
				if c.Global.JiraAPIURL == nil {
					return nil, errors.New("no global Jira Cloud URL set")
				}
				jira.APIURL = c.Global.JiraAPIURL
			}
		}
		names[rcv.Name] = struct{}{}
	}

	return &c, nil
}

// GrafanaToUpstreamConfig converts a Grafana alerting configuration into an upstream Alertmanager configuration.
// It ignores the configuration for Grafana receivers, adding only their names.
func GrafanaToUpstreamConfig(cfg *PostableApiAlertingConfig) config.Config {
	rcvs := make([]config.Receiver, 0, len(cfg.Receivers))
	for _, r := range cfg.Receivers {
		rcvs = append(rcvs, r.Receiver)
	}

	return config.Config{
		Global:            cfg.Global,
		Route:             cfg.Route.AsAMRoute(),
		InhibitRules:      cfg.InhibitRules,
		Receivers:         rcvs,
		Templates:         cfg.Templates,
		MuteTimeIntervals: cfg.MuteTimeIntervals,
		TimeIntervals:     cfg.TimeIntervals,
	}
}

func TemplatesMapToPostableAPITemplates(templates map[string]string, kind TemplateKind) []PostableApiTemplate {
	res := make([]PostableApiTemplate, 0, len(templates))
	for k, v := range templates {
		res = append(res, PostableApiTemplate{
			Name:    k,
			Kind:    kind,
			Content: v,
		})
	}
	return res
}
