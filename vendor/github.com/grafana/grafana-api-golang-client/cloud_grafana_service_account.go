package gapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// This function creates a service account inside the Grafana instance running in stack `stack`. It's used in order
// to provision service accounts inside Grafana while just having access to a Grafana Cloud API key.
func (c *Client) CreateGrafanaServiceAccountFromCloud(stack string, input *CreateServiceAccountRequest) (*ServiceAccountDTO, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	resp := &ServiceAccountDTO{}
	err = c.request(http.MethodPost, fmt.Sprintf("/api/instances/%s/api/serviceaccounts", stack), nil, data, resp)
	return resp, err
}

// This function creates a service account token inside the Grafana instance running in stack `stack`. It's used in order
// to provision service accounts inside Grafana while just having access to a Grafana Cloud API key.
func (c *Client) CreateGrafanaServiceAccountTokenFromCloud(stack string, input *CreateServiceAccountTokenRequest) (*CreateServiceAccountTokenResponse, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	resp := &CreateServiceAccountTokenResponse{}
	err = c.request(http.MethodPost, fmt.Sprintf("/api/instances/%s/api/serviceaccounts/%d/tokens", stack, input.ServiceAccountID), nil, data, resp)
	return resp, err
}

// The Grafana Cloud API is disconnected from the Grafana API on the stacks unfortunately. That's why we can't use
// the Grafana Cloud API key to fully manage service accounts on the Grafana API. The only thing we can do is to create
// a temporary Admin service account, and create a Grafana API client with that.
func (c *Client) CreateTemporaryStackGrafanaClient(stackSlug, tempSaPrefix string, tempKeyDuration time.Duration) (tempClient *Client, cleanup func() error, err error) {
	stack, err := c.StackBySlug(stackSlug)
	if err != nil {
		return nil, nil, err
	}

	name := fmt.Sprintf("%s%d", tempSaPrefix, time.Now().UnixNano())

	req := &CreateServiceAccountRequest{
		Name: name,
		Role: "Admin",
	}

	sa, err := c.CreateGrafanaServiceAccountFromCloud(stackSlug, req)
	if err != nil {
		return nil, nil, err
	}

	tokenRequest := &CreateServiceAccountTokenRequest{
		Name:             name,
		ServiceAccountID: sa.ID,
		SecondsToLive:    int64(tempKeyDuration.Seconds()),
	}

	token, err := c.CreateGrafanaServiceAccountTokenFromCloud(stackSlug, tokenRequest)
	if err != nil {
		return nil, nil, err
	}

	client, err := New(stack.URL, Config{APIKey: token.Key})
	if err != nil {
		return nil, nil, err
	}

	cleanup = func() error {
		_, err = client.DeleteServiceAccount(sa.ID)
		return err
	}

	return client, cleanup, nil
}
