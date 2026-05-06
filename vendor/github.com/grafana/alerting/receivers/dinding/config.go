package dinding

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/alerting/templates"
)

type Config struct {
	URL         string `json:"url,omitempty" yaml:"url,omitempty"`
	MessageType string `json:"msgType,omitempty" yaml:"msgType,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Message     string `json:"message,omitempty" yaml:"message,omitempty"`
}

const defaultDingdingMsgType = "link"

func NewConfig(jsonData json.RawMessage) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.URL == "" {
		return Config{}, errors.New("could not find url property in settings")
	}
	if settings.MessageType == "" {
		settings.MessageType = defaultDingdingMsgType
	}
	if settings.Title == "" {
		settings.Title = templates.DefaultMessageTitleEmbed
	}
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}
	return settings, nil
}
