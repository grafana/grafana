// Copyright 2020 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
)

// PublicKey represents the public key that should be used to encrypt secrets.
type PublicKey struct {
	KeyID *string `json:"key_id"`
	Key   *string `json:"key"`
}

// UnmarshalJSON implements the json.Unmarshaler interface.
// This ensures GitHub Enterprise versions which return a numeric key id
// do not error out when unmarshaling.
func (p *PublicKey) UnmarshalJSON(data []byte) error {
	var pk struct {
		KeyID interface{} `json:"key_id"`
		Key   *string     `json:"key"`
	}

	if err := json.Unmarshal(data, &pk); err != nil {
		return err
	}

	p.Key = pk.Key

	switch v := pk.KeyID.(type) {
	case nil:
		return nil
	case string:
		p.KeyID = &v
	case float64:
		p.KeyID = String(strconv.FormatFloat(v, 'f', -1, 64))
	default:
		return fmt.Errorf("unable to unmarshal %T as a string", v)
	}

	return nil
}

func (s *ActionsService) getPublicKey(ctx context.Context, url string) (*PublicKey, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	pubKey := new(PublicKey)
	resp, err := s.client.Do(ctx, req, pubKey)
	if err != nil {
		return nil, resp, err
	}

	return pubKey, resp, nil
}

// GetRepoPublicKey gets a public key that should be used for secret encryption.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#get-a-repository-public-key
//
//meta:operation GET /repos/{owner}/{repo}/actions/secrets/public-key
func (s *ActionsService) GetRepoPublicKey(ctx context.Context, owner, repo string) (*PublicKey, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/secrets/public-key", owner, repo)
	return s.getPublicKey(ctx, url)
}

// GetOrgPublicKey gets a public key that should be used for secret encryption.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#get-an-organization-public-key
//
//meta:operation GET /orgs/{org}/actions/secrets/public-key
func (s *ActionsService) GetOrgPublicKey(ctx context.Context, org string) (*PublicKey, *Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/public-key", org)
	return s.getPublicKey(ctx, url)
}

// GetEnvPublicKey gets a public key that should be used for secret encryption.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.7/rest/actions/secrets#get-an-environment-public-key
//
//meta:operation GET /repositories/{repository_id}/environments/{environment_name}/secrets/public-key
func (s *ActionsService) GetEnvPublicKey(ctx context.Context, repoID int, env string) (*PublicKey, *Response, error) {
	url := fmt.Sprintf("repositories/%v/environments/%v/secrets/public-key", repoID, env)
	return s.getPublicKey(ctx, url)
}

// Secret represents a repository action secret.
type Secret struct {
	Name                    string    `json:"name"`
	CreatedAt               Timestamp `json:"created_at"`
	UpdatedAt               Timestamp `json:"updated_at"`
	Visibility              string    `json:"visibility,omitempty"`
	SelectedRepositoriesURL string    `json:"selected_repositories_url,omitempty"`
}

// Secrets represents one item from the ListSecrets response.
type Secrets struct {
	TotalCount int       `json:"total_count"`
	Secrets    []*Secret `json:"secrets"`
}

func (s *ActionsService) listSecrets(ctx context.Context, url string, opts *ListOptions) (*Secrets, *Response, error) {
	u, err := addOptions(url, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	secrets := new(Secrets)
	resp, err := s.client.Do(ctx, req, &secrets)
	if err != nil {
		return nil, resp, err
	}

	return secrets, resp, nil
}

// ListRepoSecrets lists all secrets available in a repository
// without revealing their encrypted values.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#list-repository-secrets
//
//meta:operation GET /repos/{owner}/{repo}/actions/secrets
func (s *ActionsService) ListRepoSecrets(ctx context.Context, owner, repo string, opts *ListOptions) (*Secrets, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/secrets", owner, repo)
	return s.listSecrets(ctx, url, opts)
}

// ListRepoOrgSecrets lists all organization secrets available in a repository
// without revealing their encrypted values.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#list-repository-organization-secrets
//
//meta:operation GET /repos/{owner}/{repo}/actions/organization-secrets
func (s *ActionsService) ListRepoOrgSecrets(ctx context.Context, owner, repo string, opts *ListOptions) (*Secrets, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/organization-secrets", owner, repo)
	return s.listSecrets(ctx, url, opts)
}

// ListOrgSecrets lists all secrets available in an organization
// without revealing their encrypted values.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#list-organization-secrets
//
//meta:operation GET /orgs/{org}/actions/secrets
func (s *ActionsService) ListOrgSecrets(ctx context.Context, org string, opts *ListOptions) (*Secrets, *Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets", org)
	return s.listSecrets(ctx, url, opts)
}

// ListEnvSecrets lists all secrets available in an environment.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.7/rest/actions/secrets#list-environment-secrets
//
//meta:operation GET /repositories/{repository_id}/environments/{environment_name}/secrets
func (s *ActionsService) ListEnvSecrets(ctx context.Context, repoID int, env string, opts *ListOptions) (*Secrets, *Response, error) {
	url := fmt.Sprintf("repositories/%v/environments/%v/secrets", repoID, env)
	return s.listSecrets(ctx, url, opts)
}

func (s *ActionsService) getSecret(ctx context.Context, url string) (*Secret, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	secret := new(Secret)
	resp, err := s.client.Do(ctx, req, secret)
	if err != nil {
		return nil, resp, err
	}

	return secret, resp, nil
}

// GetRepoSecret gets a single repository secret without revealing its encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#get-a-repository-secret
//
//meta:operation GET /repos/{owner}/{repo}/actions/secrets/{secret_name}
func (s *ActionsService) GetRepoSecret(ctx context.Context, owner, repo, name string) (*Secret, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/secrets/%v", owner, repo, name)
	return s.getSecret(ctx, url)
}

// GetOrgSecret gets a single organization secret without revealing its encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#get-an-organization-secret
//
//meta:operation GET /orgs/{org}/actions/secrets/{secret_name}
func (s *ActionsService) GetOrgSecret(ctx context.Context, org, name string) (*Secret, *Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/%v", org, name)
	return s.getSecret(ctx, url)
}

// GetEnvSecret gets a single environment secret without revealing its encrypted value.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.7/rest/actions/secrets#get-an-environment-secret
//
//meta:operation GET /repositories/{repository_id}/environments/{environment_name}/secrets/{secret_name}
func (s *ActionsService) GetEnvSecret(ctx context.Context, repoID int, env, secretName string) (*Secret, *Response, error) {
	url := fmt.Sprintf("repositories/%v/environments/%v/secrets/%v", repoID, env, secretName)
	return s.getSecret(ctx, url)
}

// SelectedRepoIDs are the repository IDs that have access to the actions secrets.
type SelectedRepoIDs []int64

// EncryptedSecret represents a secret that is encrypted using a public key.
//
// The value of EncryptedValue must be your secret, encrypted with
// LibSodium (see documentation here: https://libsodium.gitbook.io/doc/bindings_for_other_languages)
// using the public key retrieved using the GetPublicKey method.
type EncryptedSecret struct {
	Name                  string          `json:"-"`
	KeyID                 string          `json:"key_id"`
	EncryptedValue        string          `json:"encrypted_value"`
	Visibility            string          `json:"visibility,omitempty"`
	SelectedRepositoryIDs SelectedRepoIDs `json:"selected_repository_ids,omitempty"`
}

func (s *ActionsService) putSecret(ctx context.Context, url string, eSecret *EncryptedSecret) (*Response, error) {
	req, err := s.client.NewRequest("PUT", url, eSecret)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// CreateOrUpdateRepoSecret creates or updates a repository secret with an encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#create-or-update-a-repository-secret
//
//meta:operation PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}
func (s *ActionsService) CreateOrUpdateRepoSecret(ctx context.Context, owner, repo string, eSecret *EncryptedSecret) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/secrets/%v", owner, repo, eSecret.Name)
	return s.putSecret(ctx, url, eSecret)
}

// CreateOrUpdateOrgSecret creates or updates an organization secret with an encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#create-or-update-an-organization-secret
//
//meta:operation PUT /orgs/{org}/actions/secrets/{secret_name}
func (s *ActionsService) CreateOrUpdateOrgSecret(ctx context.Context, org string, eSecret *EncryptedSecret) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/%v", org, eSecret.Name)
	return s.putSecret(ctx, url, eSecret)
}

// CreateOrUpdateEnvSecret creates or updates a single environment secret with an encrypted value.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.7/rest/actions/secrets#create-or-update-an-environment-secret
//
//meta:operation PUT /repositories/{repository_id}/environments/{environment_name}/secrets/{secret_name}
func (s *ActionsService) CreateOrUpdateEnvSecret(ctx context.Context, repoID int, env string, eSecret *EncryptedSecret) (*Response, error) {
	url := fmt.Sprintf("repositories/%v/environments/%v/secrets/%v", repoID, env, eSecret.Name)
	return s.putSecret(ctx, url, eSecret)
}

func (s *ActionsService) deleteSecret(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DeleteRepoSecret deletes a secret in a repository using the secret name.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#delete-a-repository-secret
//
//meta:operation DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}
func (s *ActionsService) DeleteRepoSecret(ctx context.Context, owner, repo, name string) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/secrets/%v", owner, repo, name)
	return s.deleteSecret(ctx, url)
}

// DeleteOrgSecret deletes a secret in an organization using the secret name.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#delete-an-organization-secret
//
//meta:operation DELETE /orgs/{org}/actions/secrets/{secret_name}
func (s *ActionsService) DeleteOrgSecret(ctx context.Context, org, name string) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/%v", org, name)
	return s.deleteSecret(ctx, url)
}

// DeleteEnvSecret deletes a secret in an environment using the secret name.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.7/rest/actions/secrets#delete-an-environment-secret
//
//meta:operation DELETE /repositories/{repository_id}/environments/{environment_name}/secrets/{secret_name}
func (s *ActionsService) DeleteEnvSecret(ctx context.Context, repoID int, env, secretName string) (*Response, error) {
	url := fmt.Sprintf("repositories/%v/environments/%v/secrets/%v", repoID, env, secretName)
	return s.deleteSecret(ctx, url)
}

// SelectedReposList represents the list of repositories selected for an organization secret.
type SelectedReposList struct {
	TotalCount   *int          `json:"total_count,omitempty"`
	Repositories []*Repository `json:"repositories,omitempty"`
}

func (s *ActionsService) listSelectedReposForSecret(ctx context.Context, url string, opts *ListOptions) (*SelectedReposList, *Response, error) {
	u, err := addOptions(url, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	result := new(SelectedReposList)
	resp, err := s.client.Do(ctx, req, result)
	if err != nil {
		return nil, resp, err
	}

	return result, resp, nil
}

// ListSelectedReposForOrgSecret lists all repositories that have access to a secret.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#list-selected-repositories-for-an-organization-secret
//
//meta:operation GET /orgs/{org}/actions/secrets/{secret_name}/repositories
func (s *ActionsService) ListSelectedReposForOrgSecret(ctx context.Context, org, name string, opts *ListOptions) (*SelectedReposList, *Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/%v/repositories", org, name)
	return s.listSelectedReposForSecret(ctx, url, opts)
}

func (s *ActionsService) setSelectedReposForSecret(ctx context.Context, url string, ids SelectedRepoIDs) (*Response, error) {
	type repoIDs struct {
		SelectedIDs SelectedRepoIDs `json:"selected_repository_ids"`
	}

	req, err := s.client.NewRequest("PUT", url, repoIDs{SelectedIDs: ids})
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// SetSelectedReposForOrgSecret sets the repositories that have access to a secret.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#set-selected-repositories-for-an-organization-secret
//
//meta:operation PUT /orgs/{org}/actions/secrets/{secret_name}/repositories
func (s *ActionsService) SetSelectedReposForOrgSecret(ctx context.Context, org, name string, ids SelectedRepoIDs) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/%v/repositories", org, name)
	return s.setSelectedReposForSecret(ctx, url, ids)
}

func (s *ActionsService) addSelectedRepoToSecret(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("PUT", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// AddSelectedRepoToOrgSecret adds a repository to an organization secret.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#add-selected-repository-to-an-organization-secret
//
//meta:operation PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}
func (s *ActionsService) AddSelectedRepoToOrgSecret(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/%v/repositories/%v", org, name, *repo.ID)
	return s.addSelectedRepoToSecret(ctx, url)
}

func (s *ActionsService) removeSelectedRepoFromSecret(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveSelectedRepoFromOrgSecret removes a repository from an organization secret.
//
// GitHub API docs: https://docs.github.com/rest/actions/secrets#remove-selected-repository-from-an-organization-secret
//
//meta:operation DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}
func (s *ActionsService) RemoveSelectedRepoFromOrgSecret(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/secrets/%v/repositories/%v", org, name, *repo.ID)
	return s.removeSelectedRepoFromSecret(ctx, url)
}
