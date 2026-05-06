package kafka

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// The user can choose which API version to use when sending
// messages to Kafka. The default is v2.
// Details on how these versions differ can be found here:
// https://docs.confluent.io/platform/current/kafka-rest/api.html
const (
	apiVersionV2 = "v2"
	apiVersionV3 = "v3"
)

type Config struct {
	Endpoint       string `json:"kafkaRestProxy,omitempty" yaml:"kafkaRestProxy,omitempty"`
	Topic          string `json:"kafkaTopic,omitempty" yaml:"kafkaTopic,omitempty"`
	Description    string `json:"description,omitempty" yaml:"description,omitempty"`
	Details        string `json:"details,omitempty" yaml:"details,omitempty"`
	Username       string `json:"username,omitempty" yaml:"username,omitempty"`
	Password       string `json:"password,omitempty" yaml:"password,omitempty"`
	APIVersion     string `json:"apiVersion,omitempty" yaml:"apiVersion,omitempty"`
	KafkaClusterID string `json:"kafkaClusterId,omitempty" yaml:"kafkaClusterId,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.Endpoint == "" {
		return Config{}, errors.New("could not find kafka rest proxy endpoint property in settings")
	}
	settings.Endpoint = strings.TrimRight(settings.Endpoint, "/")

	if settings.Topic == "" {
		return Config{}, errors.New("could not find kafka topic property in settings")
	}
	if settings.Description == "" {
		settings.Description = templates.DefaultMessageTitleEmbed
	}
	if settings.Details == "" {
		settings.Details = templates.DefaultMessageEmbed
	}
	settings.Password = decryptFn("password", settings.Password)

	if settings.APIVersion == "" {
		settings.APIVersion = apiVersionV2
	} else if settings.APIVersion == apiVersionV3 {
		if settings.KafkaClusterID == "" {
			return Config{}, errors.New("kafka cluster id must be provided when using api version 3")
		}
	} else if settings.APIVersion != apiVersionV2 && settings.APIVersion != apiVersionV3 {
		return Config{}, fmt.Errorf("unsupported api version: %s", settings.APIVersion)
	}
	return settings, nil
}
