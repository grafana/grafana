package alertmanager

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/alerting/receivers"
)

type Config struct {
	URLs     []*url.URL
	User     string
	Password string
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings struct {
		URL      receivers.CommaSeparatedStrings `json:"url,omitempty" yaml:"url,omitempty"`
		User     string                          `json:"basicAuthUser,omitempty" yaml:"basicAuthUser,omitempty"`
		Password string                          `json:"basicAuthPassword,omitempty" yaml:"basicAuthPassword,omitempty"`
	}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	urls := make([]*url.URL, 0, len(settings.URL))
	for _, uS := range settings.URL {
		uS = strings.TrimSpace(uS)
		if uS == "" {
			continue
		}
		uS = strings.TrimSuffix(uS, "/") + "/api/v2/alerts"
		u, err := url.Parse(uS)
		if err != nil {
			return Config{}, fmt.Errorf("invalid url property in settings: %w", err)
		}
		urls = append(urls, u)
	}
	if len(settings.URL) == 0 || len(urls) == 0 {
		return Config{}, errors.New("could not find url property in settings")
	}
	settings.Password = decryptFn("basicAuthPassword", settings.Password)
	return Config{
		URLs:     urls,
		User:     settings.User,
		Password: settings.Password,
	}, nil
}
