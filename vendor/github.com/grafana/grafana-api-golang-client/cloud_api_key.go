package gapi

import (
	"encoding/json"
	"fmt"
)

type CreateCloudAPIKeyInput struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type ListCloudAPIKeysOutput struct {
	Items []*CloudAPIKey
}

type CloudAPIKey struct {
	ID         int
	Name       string
	Role       string
	Token      string
	Expiration string
}

func (c *Client) CreateCloudAPIKey(org string, input *CreateCloudAPIKeyInput) (*CloudAPIKey, error) {
	resp := CloudAPIKey{}
	data, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	err = c.request("POST", fmt.Sprintf("/api/orgs/%s/api-keys", org), nil, data, &resp)
	return &resp, err
}

func (c *Client) ListCloudAPIKeys(org string) (*ListCloudAPIKeysOutput, error) {
	resp := &ListCloudAPIKeysOutput{}
	err := c.request("GET", fmt.Sprintf("/api/orgs/%s/api-keys", org), nil, nil, &resp)
	return resp, err
}

func (c *Client) DeleteCloudAPIKey(org string, keyName string) error {
	return c.request("DELETE", fmt.Sprintf("/api/orgs/%s/api-keys/%s", org, keyName), nil, nil, nil)
}
