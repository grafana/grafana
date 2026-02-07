package gapi

import (
	"encoding/json"
	"fmt"
	"net/url"
	"time"
)

type CreateCloudAccessPolicyTokenInput struct {
	AccessPolicyID string     `json:"accessPolicyId"`
	Name           string     `json:"name"`
	DisplayName    string     `json:"displayName,omitempty"`
	ExpiresAt      *time.Time `json:"expiresAt,omitempty"`
}

type UpdateCloudAccessPolicyTokenInput struct {
	DisplayName string `json:"displayName"`
}

type CloudAccessPolicyToken struct {
	ID             string     `json:"id"`
	AccessPolicyID string     `json:"accessPolicyId"`
	Name           string     `json:"name"`
	DisplayName    string     `json:"displayName"`
	ExpiresAt      *time.Time `json:"expiresAt"`
	FirstUsedAt    time.Time  `json:"firstUsedAt"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      *time.Time `json:"updatedAt"`

	Token string `json:"token,omitempty"` // Only returned when creating a token.
}

type CloudAccessPolicyTokenItems struct {
	Items []*CloudAccessPolicyToken `json:"items"`
}

func (c *Client) CloudAccessPolicyTokens(region, accessPolicyID string) (CloudAccessPolicyTokenItems, error) {
	tokens := CloudAccessPolicyTokenItems{}
	err := c.request("GET", "/api/v1/tokens", url.Values{
		"region":         []string{region},
		"accessPolicyId": []string{accessPolicyID},
	}, nil, &tokens)

	return tokens, err
}

func (c *Client) CloudAccessPolicyTokenByID(region, id string) (CloudAccessPolicyToken, error) {
	token := CloudAccessPolicyToken{}
	err := c.request("GET", fmt.Sprintf("/api/v1/tokens/%s", id), url.Values{
		"region": []string{region},
	}, nil, &token)

	return token, err
}

func (c *Client) CreateCloudAccessPolicyToken(region string, input CreateCloudAccessPolicyTokenInput) (CloudAccessPolicyToken, error) {
	token := CloudAccessPolicyToken{}

	data, err := json.Marshal(input)
	if err != nil {
		return token, err
	}

	err = c.request("POST", "/api/v1/tokens", url.Values{
		"region": []string{region},
	}, data, &token)

	return token, err
}

func (c *Client) UpdateCloudAccessPolicyToken(region, id string, input UpdateCloudAccessPolicyTokenInput) (CloudAccessPolicyToken, error) {
	token := CloudAccessPolicyToken{}

	data, err := json.Marshal(input)
	if err != nil {
		return token, err
	}

	err = c.request("POST", fmt.Sprintf("/api/v1/tokens/%s", id), url.Values{
		"region": []string{region},
	}, data, &token)

	return token, err
}

func (c *Client) DeleteCloudAccessPolicyToken(region, id string) error {
	return c.request("DELETE", fmt.Sprintf("/api/v1/tokens/%s", id), url.Values{
		"region": []string{region},
	}, nil, nil)
}
