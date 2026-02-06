package gapi

import (
	"encoding/json"
	"fmt"
)

// This function creates a API key inside the Grafana instance running in stack `stack`. It's used in order
// to provision API keys inside Grafana while just having access to a Grafana Cloud API key.
//
// See https://grafana.com/docs/grafana-cloud/api/#create-grafana-api-keys for more information.
func (c *Client) CreateGrafanaAPIKeyFromCloud(stack string, input *CreateAPIKeyRequest) (*CreateAPIKeyResponse, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	resp := &CreateAPIKeyResponse{}
	err = c.request("POST", fmt.Sprintf("/api/instances/%s/api/auth/keys", stack), nil, data, resp)
	return resp, err
}
