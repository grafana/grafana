package threema

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

type Config struct {
	GatewayID   string `json:"gateway_id,omitempty" yaml:"gateway_id,omitempty"`
	RecipientID string `json:"recipient_id,omitempty" yaml:"recipient_id,omitempty"`
	APISecret   string `json:"api_secret,omitempty" yaml:"api_secret,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	// GatewayID validaiton
	if settings.GatewayID == "" {
		return settings, errors.New("could not find Threema Gateway ID in settings")
	}
	if !strings.HasPrefix(settings.GatewayID, "*") {
		return settings, errors.New("invalid Threema Gateway ID: Must start with a *")
	}
	if len(settings.GatewayID) != 8 {
		return settings, errors.New("invalid Threema Gateway ID: Must be 8 characters long")
	}

	// RecipientID validation
	if settings.RecipientID == "" {
		return settings, errors.New("could not find Threema Recipient ID in settings")
	}
	if len(settings.RecipientID) != 8 {
		return settings, errors.New("invalid Threema Recipient ID: Must be 8 characters long")
	}
	settings.APISecret = decryptFn("api_secret", settings.APISecret)
	if settings.APISecret == "" {
		return settings, errors.New("could not find Threema API secret in settings")
	}

	if settings.Description == "" {
		settings.Description = templates.DefaultMessageEmbed
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}

	return settings, nil
}
