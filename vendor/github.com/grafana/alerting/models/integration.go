package models

import "encoding/json"

type IntegrationConfig struct {
	UID                   string            `json:"uid" yaml:"uid"`
	Name                  string            `json:"name" yaml:"name"`
	Type                  string            `json:"type" yaml:"type"`
	DisableResolveMessage bool              `json:"disableResolveMessage" yaml:"disableResolveMessage"`
	Settings              json.RawMessage   `json:"settings" yaml:"settings"`
	SecureSettings        map[string]string `json:"secureSettings" yaml:"secureSettings"`
}

type ReceiverConfig struct {
	Integrations []*IntegrationConfig `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}
