package dockercfg

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// UserHomeConfigPath returns the path to the docker config in the current user's home dir.
func UserHomeConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("user home dir: %w", err)
	}

	return filepath.Join(home, ".docker", "config.json"), nil
}

// ConfigPath returns the path to the docker cli config.
//
// It will either use the DOCKER_CONFIG env var if set, or the value from [UserHomeConfigPath]
// DOCKER_CONFIG would be the dir path where `config.json` is stored, this returns the path to config.json.
func ConfigPath() (string, error) {
	if p := os.Getenv("DOCKER_CONFIG"); p != "" {
		return filepath.Join(p, "config.json"), nil
	}
	return UserHomeConfigPath()
}

// LoadDefaultConfig loads the docker cli config from the path returned from [ConfigPath].
func LoadDefaultConfig() (Config, error) {
	var cfg Config
	p, err := ConfigPath()
	if err != nil {
		return cfg, fmt.Errorf("config path: %w", err)
	}

	return cfg, FromFile(p, &cfg)
}

// FromFile loads config from the specified path into cfg.
func FromFile(configPath string, cfg *Config) error {
	f, err := os.Open(configPath)
	if err != nil {
		return fmt.Errorf("open config: %w", err)
	}
	defer f.Close()

	if err = json.NewDecoder(f).Decode(&cfg); err != nil {
		return fmt.Errorf("decode config: %w", err)
	}

	return nil
}
