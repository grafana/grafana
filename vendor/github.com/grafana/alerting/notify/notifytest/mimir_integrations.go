package notifytest

import (
	"encoding/json"
	"fmt"
	"maps"
	"reflect"
	"slices"

	promCfg "github.com/prometheus/alertmanager/config"

	discordV0 "github.com/grafana/alerting/receivers/discord/v0mimir1"
	emailV0 "github.com/grafana/alerting/receivers/email/v0mimir1"
	jiraV0 "github.com/grafana/alerting/receivers/jira/v0mimir1"
	opsgenieV0 "github.com/grafana/alerting/receivers/opsgenie/v0mimir1"
	pagerdutyV0 "github.com/grafana/alerting/receivers/pagerduty/v0mimir1"
	pushoverV0 "github.com/grafana/alerting/receivers/pushover/v0mimir1"
	slackV0 "github.com/grafana/alerting/receivers/slack/v0mimir1"
	snsV0 "github.com/grafana/alerting/receivers/sns/v0mimir1"
	msteamsV01 "github.com/grafana/alerting/receivers/teams/v0mimir1"
	msteamsV02 "github.com/grafana/alerting/receivers/teams/v0mimir2"
	telegramV0 "github.com/grafana/alerting/receivers/telegram/v0mimir1"
	victoropsV0 "github.com/grafana/alerting/receivers/victorops/v0mimir1"
	webexV0 "github.com/grafana/alerting/receivers/webex/v0mimir1"
	webhookV0 "github.com/grafana/alerting/receivers/webhook/v0mimir1"
	wechatV0 "github.com/grafana/alerting/receivers/wechat/v0mimir1"
)

type MimirIntegrationHTTPConfigOption string

const (
	WithBasicAuth             = MimirIntegrationHTTPConfigOption("basic_auth")
	WithLegacyBearerTokenAuth = MimirIntegrationHTTPConfigOption("bearer_token")
	WithAuthorization         = MimirIntegrationHTTPConfigOption("authorization")
	WithOAuth2                = MimirIntegrationHTTPConfigOption("oauth2")
	WithTLS                   = MimirIntegrationHTTPConfigOption("tls_config")
	WithHeaders               = MimirIntegrationHTTPConfigOption("headers")
	WithProxy                 = MimirIntegrationHTTPConfigOption("proxy_config")
	WithDefault               = MimirIntegrationHTTPConfigOption("default")
)

// GetMimirIntegration creates a new instance of the given integration type with selected http config options.
// It panics if the configuration process encounters an issue.
func GetMimirIntegration[T any](opts ...MimirIntegrationHTTPConfigOption) (T, error) {
	var config T
	cfg, err := GetRawConfigForMimirIntegration(reflect.TypeOf(config), opts...)
	if err != nil {
		return config, err
	}
	err = json.Unmarshal([]byte(cfg), &config)
	if err != nil {
		return config, fmt.Errorf("failed to unmarshal config %T: %v", config, err)
	}
	return config, nil
}

// GetMimirIntegrationForType creates a new instance of the given integration type with selected http config options.
// It panics if the configuration process encounters an issue.
func GetMimirIntegrationForType(iType reflect.Type, opts ...MimirIntegrationHTTPConfigOption) (any, error) {
	cfg, err := GetRawConfigForMimirIntegration(iType, opts...)
	if err != nil {
		return nil, err
	}
	elemPtr := reflect.New(iType).Interface()
	err = json.Unmarshal([]byte(cfg), elemPtr)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal config %T: %v", iType, err)
	}
	return elemPtr, nil
}

// GetMimirReceiverWithIntegrations creates a Receiver with selected integrations configured from given types and options.
// It returns a Receiver for testing purposes or an error if the configuration process encounters an issue.
func GetMimirReceiverWithIntegrations(iTypes []reflect.Type, opts ...MimirIntegrationHTTPConfigOption) (promCfg.Receiver, error) {
	receiver := promCfg.Receiver{Name: "receiver"}
	receiverVal := reflect.ValueOf(&receiver).Elem()
	receiverType := receiverVal.Type()
	for i := 0; i < receiverType.NumField(); i++ {
		integrationField := receiverType.Field(i)
		if integrationField.Type.Kind() != reflect.Slice {
			continue
		}
		sliceType := integrationField.Type
		elemType := sliceType.Elem()

		sliceVal := reflect.MakeSlice(sliceType, 0, 1)

		// Create a new instance of the element type
		elemPtr := reflect.New(elemType).Interface()
		underlyingType := elemType
		if underlyingType.Kind() == reflect.Ptr {
			underlyingType = underlyingType.Elem()
		}
		if !slices.Contains(iTypes, underlyingType) {
			continue
		}
		rawConfig, err := GetRawConfigForMimirIntegration(underlyingType, opts...)
		if err != nil {
			return promCfg.Receiver{}, fmt.Errorf("failed to get config for type [%s]: %v", underlyingType.String(), err)
		}
		if err := json.Unmarshal([]byte(rawConfig), elemPtr); err != nil {
			return promCfg.Receiver{}, fmt.Errorf("failed to parse config for type %s: %v", elemType.String(), err)
		}
		sliceVal = reflect.Append(sliceVal, reflect.ValueOf(elemPtr).Elem())
		receiverVal.FieldByName(integrationField.Name).Set(sliceVal)
	}
	return receiver, nil
}

// GetMimirReceiverWithAllIntegrations creates a Receiver with all integrations configured from given types and options.
// It returns a Receiver for testing purposes or an error if the configuration process encounters an issue.
func GetMimirReceiverWithAllIntegrations(opts ...MimirIntegrationHTTPConfigOption) (promCfg.Receiver, error) {
	return GetMimirReceiverWithIntegrations(slices.Collect(maps.Keys(AllValidMimirConfigs)), opts...)
}

func GetRawConfigForMimirIntegration(iType reflect.Type, opts ...MimirIntegrationHTTPConfigOption) (string, error) {
	cfg, ok := AllValidMimirConfigs[iType]
	if !ok {
		return "", fmt.Errorf("invalid config type [%s", iType.String())
	}
	if _, ok := iType.FieldByName("HTTPConfig"); !ok { // ignore integrations without HTTPConfig
		return cfg, nil
	}
	if len(opts) == 0 {
		opts = []MimirIntegrationHTTPConfigOption{WithDefault}
	}
	for _, opt := range opts {
		c, ok := ValidMimirHTTPConfigs[opt]
		if !ok {
			return "", fmt.Errorf("invalid option [%s]", opt)
		}
		bytes, err := mergeSettings([]byte(cfg), []byte(c))
		if err != nil {
			return "", fmt.Errorf("failed to merge config for type [%s] with options [%s]: %v", iType.String(), opt, err)
		}
		cfg = string(bytes)
	}
	return cfg, nil
}

var ValidMimirHTTPConfigs = map[MimirIntegrationHTTPConfigOption]string{
	WithBasicAuth: `{
		"http_config": {
			"tls_config": {
				"insecure_skip_verify": false
			},
			"follow_redirects": true,
			"enable_http2": true,
			"proxy_url": "",
			"basic_auth": {
				"username": "test-username",
				"password": "test-password"
			}
		}
	}`,
	WithLegacyBearerTokenAuth: `{
		"http_config": {
			"tls_config": {
				"insecure_skip_verify": false
			},
			"follow_redirects": true,
			"enable_http2": true,
			"proxy_url": "",
			"bearer_token": "test-token"
		}
	}`,
	WithAuthorization: `{
		"http_config": {
			"tls_config": {
				"insecure_skip_verify": false
			},
			"follow_redirects": true,
			"enable_http2": true,
			"proxy_url": "",
			"authorization": {
				"type": "bearer",
				"credentials": "test-credentials"
			}
		}
	}`,
	WithOAuth2: `{
		"http_config": {
			"tls_config": {
				"insecure_skip_verify": false
			},
			"follow_redirects": true,
			"enable_http2": true,
			"proxy_url": "",
			"oauth2": {
				"client_id": "test-client-id",
				"client_secret": "test-client-secret",
				"client_secret_file": "",
				"client_secret_ref": "",
				"token_url": "https://localhost/auth/token",
				"scopes": ["scope1", "scope2"],
				"endpoint_params": {
					"param1": "value1",
					"param2": "value2"
				},
				"TLSConfig": {
                    "insecure_skip_verify": false
				},
				"proxy_url": ""
			}
	    }
	}`,
	WithTLS: `{
		"http_config": {
			"follow_redirects": true,
			"enable_http2": true,
			"proxy_url": "",
			"tls_config": {
				"insecure_skip_verify": false,
				"server_name": "test-server-name"
			}
	    }
	}`,
	WithHeaders: `{
		"http_config": {
			"tls_config": {
				"insecure_skip_verify": false
			},
			"follow_redirects": true,
			"enable_http2": true,
			"http_headers": {
				"headers": {
					"X-Header-1": {
						"secrets": ["value1"]
					},
					"X-Header-2": {
						"values": ["value2"]
					}
				}
			}
		}
	}`,
	WithProxy: `{
		"http_config": {
			"tls_config": {
				"insecure_skip_verify": false
			},
			"follow_redirects": true,
			"enable_http2": true,
			"proxy_url": "http://localproxy:8080",
			"no_proxy": "localhost",
			"proxy_connect_header": {
				"X-Proxy-Header": ["proxy-value"]
			}
		}
	}`,
	// This reflects the default
	WithDefault: `{
		"http_config": {
			"tls_config": {
				"insecure_skip_verify": false
			},
			"follow_redirects": true,
			"enable_http2": true,
			"proxy_url": ""
		}
	}`,
}

var AllValidMimirConfigs = map[reflect.Type]string{
	reflect.TypeOf(promCfg.DiscordConfig{}):   discordV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.EmailConfig{}):     emailV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.PagerdutyConfig{}): pagerdutyV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.SlackConfig{}):     slackV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.WebhookConfig{}):   webhookV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.OpsGenieConfig{}):  opsgenieV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.WechatConfig{}):    wechatV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.PushoverConfig{}):  pushoverV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.VictorOpsConfig{}): victoropsV0.FullValidConfigForTesting,
	// all sigv4 fields of SNSConfig are different in yaml
	reflect.TypeOf(promCfg.SNSConfig{}): snsV0.FullValidConfigForTesting,
	// token and chat fields of TelegramConfig are different in yaml
	reflect.TypeOf(promCfg.TelegramConfig{}):  telegramV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.WebexConfig{}):     webexV0.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.MSTeamsConfig{}):   msteamsV01.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.MSTeamsV2Config{}): msteamsV02.FullValidConfigForTesting,
	reflect.TypeOf(promCfg.JiraConfig{}):      jiraV0.FullValidConfigForTesting,
}
