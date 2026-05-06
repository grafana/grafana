package opsgenie

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"text/template"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

const (
	SendTags    = "tags"
	SendDetails = "details"
	SendBoth    = "both"

	DefaultAlertsURL = "https://api.opsgenie.com/v2/alerts"
)

var SupportedResponderTypes = []string{"team", "teams", "user", "escalation", "schedule"}

type MessageResponder struct {
	ID       string `json:"id,omitempty" yaml:"id,omitempty"`
	Name     string `json:"name,omitempty" yaml:"name,omitempty"`
	Username string `json:"username,omitempty" yaml:"username,omitempty"`
	Type     string `json:"type" yaml:"type"` // team, user, escalation, schedule etc.
}

type Config struct {
	APIKey           string
	APIUrl           string
	Message          string
	Description      string
	AutoClose        bool
	OverridePriority bool
	SendTagsAs       string
	Responders       []MessageResponder
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	type rawSettings struct {
		APIKey           string             `json:"apiKey,omitempty" yaml:"apiKey,omitempty"`
		APIUrl           string             `json:"apiUrl,omitempty" yaml:"apiUrl,omitempty"`
		Message          string             `json:"message,omitempty" yaml:"message,omitempty"`
		Description      string             `json:"description,omitempty" yaml:"description,omitempty"`
		AutoClose        *bool              `json:"autoClose,omitempty" yaml:"autoClose,omitempty"`
		OverridePriority *bool              `json:"overridePriority,omitempty" yaml:"overridePriority,omitempty"`
		SendTagsAs       string             `json:"sendTagsAs,omitempty" yaml:"sendTagsAs,omitempty"`
		Responders       []MessageResponder `json:"responders,omitempty" yaml:"responders,omitempty"`
	}

	raw := rawSettings{}
	err := json.Unmarshal(jsonData, &raw)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	raw.APIKey = decryptFn("apiKey", raw.APIKey)
	if raw.APIKey == "" {
		return Config{}, errors.New("could not find api key property in settings")
	}
	if raw.APIUrl == "" {
		raw.APIUrl = DefaultAlertsURL
	}

	if strings.TrimSpace(raw.Message) == "" {
		raw.Message = templates.DefaultMessageTitleEmbed
	}

	switch raw.SendTagsAs {
	case SendTags, SendDetails, SendBoth:
	case "":
		raw.SendTagsAs = SendTags
	default:
		return Config{}, fmt.Errorf("invalid value for sendTagsAs: %q", raw.SendTagsAs)
	}

	if raw.AutoClose == nil {
		autoClose := true
		raw.AutoClose = &autoClose
	}
	if raw.OverridePriority == nil {
		overridePriority := true
		raw.OverridePriority = &overridePriority
	}

	for idx, r := range raw.Responders {
		if r.ID == "" && r.Username == "" && r.Name == "" {
			return Config{}, fmt.Errorf("responder at index [%d] must have at least one of id, username or name specified", idx)
		}
		if strings.Contains(r.Type, "{{") {
			_, err := template.New("").Parse(r.Type)
			if err != nil {
				return Config{}, fmt.Errorf("responder at index [%d] type is not a valid template: %v", idx, err)
			}
		} else {
			r.Type = strings.ToLower(r.Type)
			match := false
			for _, t := range SupportedResponderTypes {
				if r.Type == t {
					match = true
					break
				}
			}
			if !match {
				return Config{}, fmt.Errorf("responder at index [%d] has unsupported type. Supported only: %s", idx, strings.Join(SupportedResponderTypes, ","))
			}
		}
		if r.Type == "teams" && r.Name == "" {
			return Config{}, fmt.Errorf("responder at index [%d] has type 'teams' but empty name. Must be comma-separated string of names", idx)
		}
	}

	return Config{
		APIKey:           raw.APIKey,
		APIUrl:           raw.APIUrl,
		Message:          raw.Message,
		Description:      raw.Description,
		AutoClose:        *raw.AutoClose,
		OverridePriority: *raw.OverridePriority,
		SendTagsAs:       raw.SendTagsAs,
		Responders:       raw.Responders,
	}, nil
}
