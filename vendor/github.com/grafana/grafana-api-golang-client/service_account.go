package gapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// CreateServiceAccountTokenRequest represents the request body for creating a new service account token.
type CreateServiceAccountTokenRequest struct {
	Name             string `json:"name"`
	ServiceAccountID int64  `json:"-"`
	SecondsToLive    int64  `json:"secondsToLive,omitempty"`
}

// CreateServiceAccountRequest is the request body for creating a new service account.
type CreateServiceAccountRequest struct {
	Name       string `json:"name"`
	Role       string `json:"role,omitempty"`
	IsDisabled *bool  `json:"isDisabled,omitempty"`
}

// UpdateServiceAccountRequest is the request body for modifying a service account.
type UpdateServiceAccountRequest struct {
	Name       string `json:"name,omitempty"`
	Role       string `json:"role,omitempty"`
	IsDisabled *bool  `json:"isDisabled,omitempty"`
}

// ServiceAccountDTO represents a Grafana service account.
type ServiceAccountDTO struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Login      string `json:"login"`
	OrgID      int64  `json:"orgId"`
	IsDisabled bool   `json:"isDisabled"`
	Role       string `json:"role"`
	Tokens     int64  `json:"tokens"`
	AvatarURL  string `json:"avatarUrl"`
}

type RetrieveServiceAccountResponse struct {
	TotalCount      int64               `json:"totalCount"`
	ServiceAccounts []ServiceAccountDTO `json:"serviceAccounts"`
	Page            int64               `json:"page"`
	PerPage         int64               `json:"perPage"`
}

// CreateServiceAccountTokenResponse represents the response
// from the Grafana API when creating a service account token.
type CreateServiceAccountTokenResponse struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Key  string `json:"key"`
}

// GetServiceAccountTokensResponse represents a Grafana service account token.
type GetServiceAccountTokensResponse struct {
	ID                     int64      `json:"id"`
	Name                   string     `json:"name"`
	Created                time.Time  `json:"created,omitempty"`
	Expiration             *time.Time `json:"expiration,omitempty"`
	SecondsUntilExpiration *float64   `json:"secondsUntilExpiration,omitempty"`
	HasExpired             bool       `json:"hasExpired,omitempty"`
}

// DeleteServiceAccountResponse represents the response from deleting a service account
// or a service account token.
type DeleteServiceAccountResponse struct {
	Message string `json:"message"`
}

// CreateServiceAccount creates a new Grafana service account.
func (c *Client) CreateServiceAccount(request CreateServiceAccountRequest) (*ServiceAccountDTO, error) {
	response := ServiceAccountDTO{}

	data, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	err = c.request(http.MethodPost, "/api/serviceaccounts/", nil, data, &response)
	return &response, err
}

// CreateServiceAccountToken creates a new Grafana service account token.
func (c *Client) CreateServiceAccountToken(request CreateServiceAccountTokenRequest) (*CreateServiceAccountTokenResponse, error) {
	response := CreateServiceAccountTokenResponse{}

	data, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	err = c.request(http.MethodPost,
		fmt.Sprintf("/api/serviceaccounts/%d/tokens", request.ServiceAccountID),
		nil, data, &response)
	return &response, err
}

// UpdateServiceAccount updates a specific serviceAccountID
func (c *Client) UpdateServiceAccount(serviceAccountID int64, request UpdateServiceAccountRequest) (*ServiceAccountDTO, error) {
	response := ServiceAccountDTO{}

	data, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	err = c.request(http.MethodPatch,
		fmt.Sprintf("/api/serviceaccounts/%d", serviceAccountID),
		nil, data, &response)
	return &response, err
}

// GetServiceAccounts retrieves a list of all service accounts for the organization.
func (c *Client) GetServiceAccounts() ([]ServiceAccountDTO, error) {
	response := RetrieveServiceAccountResponse{}

	if err := c.request(http.MethodGet, "/api/serviceaccounts/search", nil, nil, &response); err != nil {
		return nil, err
	}

	return response.ServiceAccounts, nil
}

// GetServiceAccountTokens retrieves a list of all service account tokens for a specific service account.
func (c *Client) GetServiceAccountTokens(serviceAccountID int64) ([]GetServiceAccountTokensResponse, error) {
	response := make([]GetServiceAccountTokensResponse, 0)

	err := c.request(http.MethodGet,
		fmt.Sprintf("/api/serviceaccounts/%d/tokens", serviceAccountID),
		nil, nil, &response)
	return response, err
}

// DeleteServiceAccount deletes the Grafana service account with the specified ID.
func (c *Client) DeleteServiceAccount(serviceAccountID int64) (*DeleteServiceAccountResponse, error) {
	response := DeleteServiceAccountResponse{}

	path := fmt.Sprintf("/api/serviceaccounts/%d", serviceAccountID)
	err := c.request(http.MethodDelete, path, nil, nil, &response)
	return &response, err
}

// DeleteServiceAccountToken deletes the Grafana service account token with the specified ID.
func (c *Client) DeleteServiceAccountToken(serviceAccountID, tokenID int64) (*DeleteServiceAccountResponse, error) {
	response := DeleteServiceAccountResponse{}

	path := fmt.Sprintf("/api/serviceaccounts/%d/tokens/%d", serviceAccountID, tokenID)
	err := c.request(http.MethodDelete, path, nil, nil, &response)
	return &response, err
}
