package email

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/alerting/templates"
)

type Config struct {
	SingleEmail bool
	Addresses   []string
	Message     string
	Subject     string
}

func NewConfig(jsonData json.RawMessage) (Config, error) {
	type emailSettingsRaw struct {
		SingleEmail bool   `json:"singleEmail,omitempty" yaml:"singleEmail,omitempty"`
		Addresses   string `json:"addresses,omitempty" yaml:"addresses,omitempty"`
		Message     string `json:"message,omitempty" yaml:"message,omitempty"`
		Subject     string `json:"subject,omitempty" yaml:"subject,omitempty"`
	}

	var settings emailSettingsRaw
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.Addresses == "" {
		return Config{}, errors.New("could not find addresses in settings")
	}
	// split addresses with a few different ways
	addresses := splitEmails(settings.Addresses)

	if settings.Subject == "" {
		settings.Subject = templates.DefaultMessageTitleEmbed
	}

	return Config{
		SingleEmail: settings.SingleEmail,
		Message:     settings.Message,
		Subject:     settings.Subject,
		Addresses:   addresses,
	}, nil
}

func splitEmails(emails string) []string {
	return strings.FieldsFunc(emails, func(r rune) bool {
		switch r {
		case ',', ';', '\n':
			return true
		}
		return false
	})
}
