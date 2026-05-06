package utils

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"golang.org/x/oauth2/google"
)

func GCEDefaultProject(ctx context.Context, scope string) (string, error) {
	defaultCredentials, err := google.FindDefaultCredentials(ctx, scope)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve default project from GCE metadata server: %w", err)
	}
	token, err := defaultCredentials.TokenSource.Token()
	if err != nil {
		return "", fmt.Errorf("failed to retrieve GCP credential token: %w", err)
	}
	if !token.Valid() {
		return "", errors.New("failed to validate GCP credentials")
	}

	return defaultCredentials.ProjectID, nil
}

func readPrivateKeyFromFile(rsaPrivateKeyLocation string) (string, error) {
	if rsaPrivateKeyLocation == "" {
		return "", fmt.Errorf("missing file location for private key")
	}

	privateKey, err := os.ReadFile(rsaPrivateKeyLocation)
	if err != nil {
		return "", fmt.Errorf("could not read private key file from file system: %w", err)
	}

	return string(privateKey), nil
}

type JSONData struct {
	PrivateKeyPath string `json:"privateKeyPath"`
}

// Check if a private key path was provided. Fall back to the plugin's default method
// of an inline private key
func GetPrivateKey(settings *backend.DataSourceInstanceSettings) (string, error) {
	jsonData := JSONData{}

	if err := json.Unmarshal(settings.JSONData, &jsonData); err != nil {
		return "", fmt.Errorf("could not unmarshal DataSourceInfo json: %w", err)
	}

	if jsonData.PrivateKeyPath != "" {
		privateKey, err := readPrivateKeyFromFile(jsonData.PrivateKeyPath)
		if err != nil {
			return "", fmt.Errorf("could not write private key to DataSourceInfo json: %w", err)
		}

		return privateKey, nil
	} else {
		privateKey := settings.DecryptedSecureJSONData["privateKey"]
		// React might escape newline characters like this \\n so we need to handle that
		return strings.ReplaceAll(privateKey, "\\n", "\n"), nil
	}
}
