package config

import (
	"encoding/json"
	"os"
)

// Config is the configuration for the proxy.
type Config struct {
	// Storage is the storage configuration(s).
	Storage []*StorageConfig `json:"storage"`
	// Address is the address for the proxy server to listen on.
	Address string `json:"address"`
	// Hosts is a list of hosts that are allowed to be recorded and played back.
	Hosts []string `json:"hosts"`
	// CAConfig is the paths to the Certificate Authority key pair.
	CAConfig CAConfig `json:"ca_keypair"`
}

// StorageConfig defines the storage configuration for the proxy.
type StorageConfig struct {
	// Type is the type of storage.
	Type StorageType `json:"type"`
	// Path is the path to the storage file (valid for HAR and OpenAPI).
	Path string `json:"path"`
}

// CAConfig is the paths to the Certificate Authority key pair.
type CAConfig struct {
	// Cert is the PEM encoded certificate.
	Cert string `json:"cert"`
	// PrivateKey is the PEM encoded private key.
	PrivateKey string `json:"private_key"`
}

// StorageType defines the type of storage used by the proxy.
type StorageType string

const (
	// StorageTypeHAR is the HAR file storage type.
	StorageTypeHAR StorageType = "har"
	// StorageTypeOpenAPI is the OpenAPI file storage type (JSON or YAML).
	StorageTypeOpenAPI StorageType = "openapi"
)

// LoadConfig loads the configuration from a JSON file path.
func LoadConfig(path string) (*Config, error) {
	if path == "" {
		path = "proxy.json"
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return &Config{
			Storage: []*StorageConfig{{
				Type: StorageTypeHAR,
				Path: "fixtures/e2e.har",
			}},
			Address: "127.0.0.1:9999",
			Hosts:   make([]string, 0),
		}, nil
	}

	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}

	if cfg.Address == "" {
		cfg.Address = "127.0.0.1:9999"
	}

	if len(cfg.Storage) == 0 {
		cfg.Storage = []*StorageConfig{{
			Type: StorageTypeHAR,
			Path: "fixtures/e2e.har",
		}}
	}

	if len(cfg.Hosts) == 0 {
		cfg.Hosts = make([]string, 0)
	}

	return &cfg, nil
}
