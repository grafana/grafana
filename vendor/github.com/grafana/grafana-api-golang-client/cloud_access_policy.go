package gapi

import (
	"encoding/json"
	"fmt"
	"net/url"
	"time"
)

type CloudAccessPolicyLabelPolicy struct {
	Selector string `json:"selector"`
}

type CloudAccessPolicyRealm struct {
	Type          string                         `json:"type"`
	Identifier    string                         `json:"identifier"`
	LabelPolicies []CloudAccessPolicyLabelPolicy `json:"labelPolicies"`
}

type CreateCloudAccessPolicyInput struct {
	Name        string                   `json:"name"`
	DisplayName string                   `json:"displayName"`
	Scopes      []string                 `json:"scopes"`
	Realms      []CloudAccessPolicyRealm `json:"realms"`
}

type UpdateCloudAccessPolicyInput struct {
	DisplayName string                   `json:"displayName"`
	Scopes      []string                 `json:"scopes"`
	Realms      []CloudAccessPolicyRealm `json:"realms"`
}

type CloudAccessPolicy struct {
	Name        string                   `json:"name"`
	DisplayName string                   `json:"displayName"`
	Scopes      []string                 `json:"scopes"`
	Realms      []CloudAccessPolicyRealm `json:"realms"`

	// The following fields are not part of the input, but are returned by the API.
	ID        string    `json:"id"`
	OrgID     string    `json:"orgId"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CloudAccessPolicyItems struct {
	Items []*CloudAccessPolicy `json:"items"`
}

func (c *Client) CloudAccessPolicies(region string) (CloudAccessPolicyItems, error) {
	policies := CloudAccessPolicyItems{}
	err := c.request("GET", "/api/v1/accesspolicies", url.Values{
		"region": []string{region},
	}, nil, &policies)

	return policies, err
}

func (c *Client) CloudAccessPolicyByID(region, id string) (CloudAccessPolicy, error) {
	policy := CloudAccessPolicy{}
	err := c.request("GET", fmt.Sprintf("/api/v1/accesspolicies/%s", id), url.Values{
		"region": []string{region},
	}, nil, &policy)

	return policy, err
}

func (c *Client) CreateCloudAccessPolicy(region string, input CreateCloudAccessPolicyInput) (CloudAccessPolicy, error) {
	result := CloudAccessPolicy{}

	data, err := json.Marshal(input)
	if err != nil {
		return result, err
	}

	err = c.request("POST", "/api/v1/accesspolicies", url.Values{
		"region": []string{region},
	}, data, &result)

	return result, err
}

func (c *Client) UpdateCloudAccessPolicy(region, id string, input UpdateCloudAccessPolicyInput) (CloudAccessPolicy, error) {
	result := CloudAccessPolicy{}

	data, err := json.Marshal(input)
	if err != nil {
		return result, err
	}

	err = c.request("POST", fmt.Sprintf("/api/v1/accesspolicies/%s", id), url.Values{
		"region": []string{region},
	}, data, &result)

	return result, err
}

func (c *Client) DeleteCloudAccessPolicy(region, id string) error {
	return c.request("DELETE", fmt.Sprintf("/api/v1/accesspolicies/%s", id), url.Values{
		"region": []string{region},
	}, nil, nil)
}
