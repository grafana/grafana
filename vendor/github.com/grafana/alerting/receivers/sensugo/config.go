package sensugo

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

type Config struct {
	URL       string `json:"url,omitempty" yaml:"url,omitempty"`
	Entity    string `json:"entity,omitempty" yaml:"entity,omitempty"`
	Check     string `json:"check,omitempty" yaml:"check,omitempty"`
	Namespace string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	Handler   string `json:"handler,omitempty" yaml:"handler,omitempty"`
	APIKey    string `json:"apikey,omitempty" yaml:"apikey,omitempty"`
	Message   string `json:"message,omitempty" yaml:"message,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.URL == "" {
		return settings, errors.New("could not find URL property in settings")
	}
	settings.APIKey = decryptFn("apikey", settings.APIKey)
	if settings.APIKey == "" {
		return settings, errors.New("could not find the API key property in settings")
	}
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}
	return settings, nil
}
