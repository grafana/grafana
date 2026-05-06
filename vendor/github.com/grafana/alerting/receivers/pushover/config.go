package pushover

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

type Config struct {
	UserKey          string
	APIToken         string
	AlertingPriority int64
	OkPriority       int64
	Retry            int64
	Expire           int64
	Device           string
	AlertingSound    string
	OkSound          string
	Upload           bool
	Title            string
	Message          string
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	settings := Config{}
	rawSettings := struct {
		UserKey          string                   `json:"userKey,omitempty" yaml:"userKey,omitempty"`
		APIToken         string                   `json:"apiToken,omitempty" yaml:"apiToken,omitempty"`
		AlertingPriority receivers.OptionalNumber `json:"priority,omitempty" yaml:"priority,omitempty"`
		OKPriority       receivers.OptionalNumber `json:"okPriority,omitempty" yaml:"okPriority,omitempty"`
		Retry            receivers.OptionalNumber `json:"retry,omitempty" yaml:"retry,omitempty"`
		Expire           receivers.OptionalNumber `json:"expire,omitempty" yaml:"expire,omitempty"`
		Device           string                   `json:"device,omitempty" yaml:"device,omitempty"`
		AlertingSound    string                   `json:"sound,omitempty" yaml:"sound,omitempty"`
		OKSound          string                   `json:"okSound,omitempty" yaml:"okSound,omitempty"`
		Upload           *bool                    `json:"uploadImage,omitempty" yaml:"uploadImage,omitempty"`
		Title            string                   `json:"title,omitempty" yaml:"title,omitempty"`
		Message          string                   `json:"message,omitempty" yaml:"message,omitempty"`
	}{}

	err := json.Unmarshal(jsonData, &rawSettings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	settings.UserKey = decryptFn("userKey", rawSettings.UserKey)
	if settings.UserKey == "" {
		return settings, errors.New("user key not found")
	}
	settings.APIToken = decryptFn("apiToken", rawSettings.APIToken)
	if settings.APIToken == "" {
		return settings, errors.New("API token not found")
	}
	if rawSettings.AlertingPriority != "" {
		settings.AlertingPriority, err = rawSettings.AlertingPriority.Int64()
		if err != nil {
			return settings, fmt.Errorf("failed to convert alerting priority to integer: %w", err)
		}
	}

	if rawSettings.OKPriority != "" {
		settings.OkPriority, err = rawSettings.OKPriority.Int64()
		if err != nil {
			return settings, fmt.Errorf("failed to convert OK priority to integer: %w", err)
		}
	}

	settings.Retry, _ = rawSettings.Retry.Int64()
	settings.Expire, _ = rawSettings.Expire.Int64()

	settings.Device = rawSettings.Device
	settings.AlertingSound = rawSettings.AlertingSound
	settings.OkSound = rawSettings.OKSound

	if rawSettings.Upload == nil || *rawSettings.Upload {
		settings.Upload = true
	}

	settings.Message = rawSettings.Message
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}

	settings.Title = rawSettings.Title
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}

	return settings, nil
}
