// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

func (s *DependabotService) getPublicKey(ctx context.Context, url string) (*PublicKey, *Response, error) {
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

// GetRepoPublicKey gets a public key that should be used for Dependabot secret encryption.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#get-a-repository-public-key
//
//meta:operation GET /repos/{owner}/{repo}/dependabot/secrets/public-key
func (s *DependabotService) GetRepoPublicKey(ctx context.Context, owner, repo string) (*PublicKey, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/secrets/public-key", owner, repo)
	return s.getPublicKey(ctx, url)
}

// GetOrgPublicKey gets a public key that should be used for Dependabot secret encryption.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#get-an-organization-public-key
//
//meta:operation GET /orgs/{org}/dependabot/secrets/public-key
func (s *DependabotService) GetOrgPublicKey(ctx context.Context, org string) (*PublicKey, *Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets/public-key", org)
	return s.getPublicKey(ctx, url)
}

func (s *DependabotService) listSecrets(ctx context.Context, url string, opts *ListOptions) (*Secrets, *Response, error) {
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

// ListRepoSecrets lists all Dependabot secrets available in a repository
// without revealing their encrypted values.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#list-repository-secrets
//
//meta:operation GET /repos/{owner}/{repo}/dependabot/secrets
func (s *DependabotService) ListRepoSecrets(ctx context.Context, owner, repo string, opts *ListOptions) (*Secrets, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/secrets", owner, repo)
	return s.listSecrets(ctx, url, opts)
}

// ListOrgSecrets lists all Dependabot secrets available in an organization
// without revealing their encrypted values.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#list-organization-secrets
//
//meta:operation GET /orgs/{org}/dependabot/secrets
func (s *DependabotService) ListOrgSecrets(ctx context.Context, org string, opts *ListOptions) (*Secrets, *Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets", org)
	return s.listSecrets(ctx, url, opts)
}

func (s *DependabotService) getSecret(ctx context.Context, url string) (*Secret, *Response, error) {
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

// GetRepoSecret gets a single repository Dependabot secret without revealing its encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#get-a-repository-secret
//
//meta:operation GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
func (s *DependabotService) GetRepoSecret(ctx context.Context, owner, repo, name string) (*Secret, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/secrets/%v", owner, repo, name)
	return s.getSecret(ctx, url)
}

// GetOrgSecret gets a single organization Dependabot secret without revealing its encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#get-an-organization-secret
//
//meta:operation GET /orgs/{org}/dependabot/secrets/{secret_name}
func (s *DependabotService) GetOrgSecret(ctx context.Context, org, name string) (*Secret, *Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets/%v", org, name)
	return s.getSecret(ctx, url)
}

// DependabotEncryptedSecret represents a secret that is encrypted using a public key for Dependabot.
//
// The value of EncryptedValue must be your secret, encrypted with
// LibSodium (see documentation here: https://libsodium.gitbook.io/doc/bindings_for_other_languages)
// using the public key retrieved using the GetPublicKey method.
type DependabotEncryptedSecret struct {
	Name                  string                           `json:"-"`
	KeyID                 string                           `json:"key_id"`
	EncryptedValue        string                           `json:"encrypted_value"`
	Visibility            string                           `json:"visibility,omitempty"`
	SelectedRepositoryIDs DependabotSecretsSelectedRepoIDs `json:"selected_repository_ids,omitempty"`
}

func (s *DependabotService) putSecret(ctx context.Context, url string, eSecret *DependabotEncryptedSecret) (*Response, error) {
	req, err := s.client.NewRequest("PUT", url, eSecret)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// CreateOrUpdateRepoSecret creates or updates a repository Dependabot secret with an encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#create-or-update-a-repository-secret
//
//meta:operation PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
func (s *DependabotService) CreateOrUpdateRepoSecret(ctx context.Context, owner, repo string, eSecret *DependabotEncryptedSecret) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/secrets/%v", owner, repo, eSecret.Name)
	return s.putSecret(ctx, url, eSecret)
}

// CreateOrUpdateOrgSecret creates or updates an organization Dependabot secret with an encrypted value.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#create-or-update-an-organization-secret
//
//meta:operation PUT /orgs/{org}/dependabot/secrets/{secret_name}
func (s *DependabotService) CreateOrUpdateOrgSecret(ctx context.Context, org string, eSecret *DependabotEncryptedSecret) (*Response, error) {
	repoIDs := make([]string, len(eSecret.SelectedRepositoryIDs))
	for i, secret := range eSecret.SelectedRepositoryIDs {
		repoIDs[i] = fmt.Sprintf("%v", secret)
	}
	params := struct {
		*DependabotEncryptedSecret
		SelectedRepositoryIDs []string `json:"selected_repository_ids,omitempty"`
	}{
		DependabotEncryptedSecret: eSecret,
		SelectedRepositoryIDs:     repoIDs,
	}

	url := fmt.Sprintf("orgs/%v/dependabot/secrets/%v", org, eSecret.Name)
	req, err := s.client.NewRequest("PUT", url, params)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

func (s *DependabotService) deleteSecret(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DeleteRepoSecret deletes a Dependabot secret in a repository using the secret name.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#delete-a-repository-secret
//
//meta:operation DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
func (s *DependabotService) DeleteRepoSecret(ctx context.Context, owner, repo, name string) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/secrets/%v", owner, repo, name)
	return s.deleteSecret(ctx, url)
}

// DeleteOrgSecret deletes a Dependabot secret in an organization using the secret name.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#delete-an-organization-secret
//
//meta:operation DELETE /orgs/{org}/dependabot/secrets/{secret_name}
func (s *DependabotService) DeleteOrgSecret(ctx context.Context, org, name string) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets/%v", org, name)
	return s.deleteSecret(ctx, url)
}

// ListSelectedReposForOrgSecret lists all repositories that have access to a Dependabot secret.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#list-selected-repositories-for-an-organization-secret
//
//meta:operation GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories
func (s *DependabotService) ListSelectedReposForOrgSecret(ctx context.Context, org, name string, opts *ListOptions) (*SelectedReposList, *Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets/%v/repositories", org, name)
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

// DependabotSecretsSelectedRepoIDs are the repository IDs that have access to the dependabot secrets.
type DependabotSecretsSelectedRepoIDs []int64

// SetSelectedReposForOrgSecret sets the repositories that have access to a Dependabot secret.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#set-selected-repositories-for-an-organization-secret
//
//meta:operation PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories
func (s *DependabotService) SetSelectedReposForOrgSecret(ctx context.Context, org, name string, ids DependabotSecretsSelectedRepoIDs) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets/%v/repositories", org, name)
	type repoIDs struct {
		SelectedIDs DependabotSecretsSelectedRepoIDs `json:"selected_repository_ids"`
	}

	req, err := s.client.NewRequest("PUT", url, repoIDs{SelectedIDs: ids})
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// AddSelectedRepoToOrgSecret adds a repository to an organization Dependabot secret.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#add-selected-repository-to-an-organization-secret
//
//meta:operation PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}
func (s *DependabotService) AddSelectedRepoToOrgSecret(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets/%v/repositories/%v", org, name, *repo.ID)
	req, err := s.client.NewRequest("PUT", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveSelectedRepoFromOrgSecret removes a repository from an organization Dependabot secret.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/secrets#remove-selected-repository-from-an-organization-secret
//
//meta:operation DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}
func (s *DependabotService) RemoveSelectedRepoFromOrgSecret(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/secrets/%v/repositories/%v", org, name, *repo.ID)
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
