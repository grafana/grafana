package victorops

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

const (
	// DefaultMessageType - Victorops uses "CRITICAL" string to indicate "Alerting" state
	DefaultMessageType = "CRITICAL"
)

type Config struct {
	URL         string `json:"url,omitempty" yaml:"url,omitempty"`
	MessageType string `json:"messageType,omitempty" yaml:"messageType,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	settings.URL = decryptFn("url", settings.URL)
	if settings.URL == "" {
		return settings, errors.New("could not find victorops url property in settings")
	}
	if settings.MessageType == "" {
		settings.MessageType = DefaultMessageType
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if settings.Description == "" {
		settings.Description = templates.DefaultMessageEmbed
	}
	return settings, nil
}
