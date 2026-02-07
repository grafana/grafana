// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ListUserSecrets list all secrets available for a users codespace
//
// Lists all secrets available for a user's Codespaces without revealing their encrypted values
// You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint
// GitHub Apps must have read access to the codespaces_user_secrets user permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#list-secrets-for-the-authenticated-user
//
//meta:operation GET /user/codespaces/secrets
func (s *CodespacesService) ListUserSecrets(ctx context.Context, opts *ListOptions) (*Secrets, *Response, error) {
	u, err := addOptions("user/codespaces/secrets", opts)
	if err != nil {
		return nil, nil, err
	}
	return s.listSecrets(ctx, u)
}

// ListOrgSecrets list all secrets available to an org
//
// Lists all Codespaces secrets available at the organization-level without revealing their encrypted values. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#list-organization-secrets
//
//meta:operation GET /orgs/{org}/codespaces/secrets
func (s *CodespacesService) ListOrgSecrets(ctx context.Context, org string, opts *ListOptions) (*Secrets, *Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}
	return s.listSecrets(ctx, u)
}

// ListRepoSecrets list all secrets available to a repo
//
// Lists all secrets available in a repository without revealing their encrypted values. You must authenticate using an access token with the repo scope to use this endpoint. GitHub Apps must have write access to the codespaces_secrets repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/repository-secrets#list-repository-secrets
//
//meta:operation GET /repos/{owner}/{repo}/codespaces/secrets
func (s *CodespacesService) ListRepoSecrets(ctx context.Context, owner, repo string, opts *ListOptions) (*Secrets, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/secrets", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}
	return s.listSecrets(ctx, u)
}

func (s *CodespacesService) listSecrets(ctx context.Context, url string) (*Secrets, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var secrets *Secrets
	resp, err := s.client.Do(ctx, req, &secrets)
	if err != nil {
		return nil, resp, err
	}

	return secrets, resp, nil
}

// GetUserPublicKey gets the users public key for encrypting codespace secrets
//
// Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets.
// You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint.
// GitHub Apps must have read access to the codespaces_user_secrets user permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#get-public-key-for-the-authenticated-user
//
//meta:operation GET /user/codespaces/secrets/public-key
func (s *CodespacesService) GetUserPublicKey(ctx context.Context) (*PublicKey, *Response, error) {
	return s.getPublicKey(ctx, "user/codespaces/secrets/public-key")
}

// GetOrgPublicKey gets the org public key for encrypting codespace secrets
//
// Gets a public key for an organization, which is required in order to encrypt secrets. You need to encrypt the value of a secret before you can create or update secrets. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#get-an-organization-public-key
//
//meta:operation GET /orgs/{org}/codespaces/secrets/public-key
func (s *CodespacesService) GetOrgPublicKey(ctx context.Context, org string) (*PublicKey, *Response, error) {
	return s.getPublicKey(ctx, fmt.Sprintf("orgs/%v/codespaces/secrets/public-key", org))
}

// GetRepoPublicKey gets the repo public key for encrypting codespace secrets
//
// Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the repo scope. GitHub Apps must have write access to the codespaces_secrets repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/repository-secrets#get-a-repository-public-key
//
//meta:operation GET /repos/{owner}/{repo}/codespaces/secrets/public-key
func (s *CodespacesService) GetRepoPublicKey(ctx context.Context, owner, repo string) (*PublicKey, *Response, error) {
	return s.getPublicKey(ctx, fmt.Sprintf("repos/%v/%v/codespaces/secrets/public-key", owner, repo))
}

func (s *CodespacesService) getPublicKey(ctx context.Context, url string) (*PublicKey, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var publicKey *PublicKey
	resp, err := s.client.Do(ctx, req, &publicKey)
	if err != nil {
		return nil, resp, err
	}

	return publicKey, resp, nil
}

// GetUserSecret gets a users codespace secret
//
// Gets a secret available to a user's codespaces without revealing its encrypted value.
// You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint.
// GitHub Apps must have read access to the codespaces_user_secrets user permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#get-a-secret-for-the-authenticated-user
//
//meta:operation GET /user/codespaces/secrets/{secret_name}
func (s *CodespacesService) GetUserSecret(ctx context.Context, name string) (*Secret, *Response, error) {
	u := fmt.Sprintf("user/codespaces/secrets/%v", name)
	return s.getSecret(ctx, u)
}

// GetOrgSecret gets an org codespace secret
//
// Gets an organization secret without revealing its encrypted value. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#get-an-organization-secret
//
//meta:operation GET /orgs/{org}/codespaces/secrets/{secret_name}
func (s *CodespacesService) GetOrgSecret(ctx context.Context, org, name string) (*Secret, *Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets/%v", org, name)
	return s.getSecret(ctx, u)
}

// GetRepoSecret gets a repo codespace secret
//
// Gets a single repository secret without revealing its encrypted value. You must authenticate using an access token with the repo scope to use this endpoint. GitHub Apps must have write access to the codespaces_secrets repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/repository-secrets#get-a-repository-secret
//
//meta:operation GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
func (s *CodespacesService) GetRepoSecret(ctx context.Context, owner, repo, name string) (*Secret, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/secrets/%v", owner, repo, name)
	return s.getSecret(ctx, u)
}

func (s *CodespacesService) getSecret(ctx context.Context, url string) (*Secret, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var secret *Secret
	resp, err := s.client.Do(ctx, req, &secret)
	if err != nil {
		return nil, resp, err
	}

	return secret, resp, nil
}

// CreateOrUpdateUserSecret creates or updates a users codespace secret
//
// Creates or updates a secret for a user's codespace with an encrypted value. Encrypt your secret using LibSodium.
// You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must also have Codespaces access to use this endpoint.
// GitHub Apps must have write access to the codespaces_user_secrets user permission and codespaces_secrets repository permission on all referenced repositories to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#create-or-update-a-secret-for-the-authenticated-user
//
//meta:operation PUT /user/codespaces/secrets/{secret_name}
func (s *CodespacesService) CreateOrUpdateUserSecret(ctx context.Context, eSecret *EncryptedSecret) (*Response, error) {
	u := fmt.Sprintf("user/codespaces/secrets/%v", eSecret.Name)
	return s.createOrUpdateSecret(ctx, u, eSecret)
}

// CreateOrUpdateOrgSecret creates or updates an orgs codespace secret
//
// Creates or updates an organization secret with an encrypted value. Encrypt your secret using LibSodium. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#create-or-update-an-organization-secret
//
//meta:operation PUT /orgs/{org}/codespaces/secrets/{secret_name}
func (s *CodespacesService) CreateOrUpdateOrgSecret(ctx context.Context, org string, eSecret *EncryptedSecret) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets/%v", org, eSecret.Name)
	return s.createOrUpdateSecret(ctx, u, eSecret)
}

// CreateOrUpdateRepoSecret creates or updates a repos codespace secret
//
// Creates or updates a repository secret with an encrypted value. Encrypt your secret using LibSodium. You must authenticate using an access token with the repo scope to use this endpoint. GitHub Apps must have write access to the codespaces_secrets repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/repository-secrets#create-or-update-a-repository-secret
//
//meta:operation PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
func (s *CodespacesService) CreateOrUpdateRepoSecret(ctx context.Context, owner, repo string, eSecret *EncryptedSecret) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/secrets/%v", owner, repo, eSecret.Name)
	return s.createOrUpdateSecret(ctx, u, eSecret)
}

func (s *CodespacesService) createOrUpdateSecret(ctx context.Context, url string, eSecret *EncryptedSecret) (*Response, error) {
	req, err := s.client.NewRequest("PUT", url, eSecret)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// DeleteUserSecret deletes a users codespace secret
//
// Deletes a secret from a user's codespaces using the secret name. Deleting the secret will remove access from all codespaces that were allowed to access the secret.
// You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint.
// GitHub Apps must have write access to the codespaces_user_secrets user permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#delete-a-secret-for-the-authenticated-user
//
//meta:operation DELETE /user/codespaces/secrets/{secret_name}
func (s *CodespacesService) DeleteUserSecret(ctx context.Context, name string) (*Response, error) {
	u := fmt.Sprintf("user/codespaces/secrets/%v", name)
	return s.deleteSecret(ctx, u)
}

// DeleteOrgSecret deletes an orgs codespace secret
//
// Deletes an organization secret using the secret name. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#delete-an-organization-secret
//
//meta:operation DELETE /orgs/{org}/codespaces/secrets/{secret_name}
func (s *CodespacesService) DeleteOrgSecret(ctx context.Context, org, name string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets/%v", org, name)
	return s.deleteSecret(ctx, u)
}

// DeleteRepoSecret deletes a repos codespace secret
//
// Deletes a secret in a repository using the secret name. You must authenticate using an access token with the repo scope to use this endpoint. GitHub Apps must have write access to the codespaces_secrets repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/repository-secrets#delete-a-repository-secret
//
//meta:operation DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
func (s *CodespacesService) DeleteRepoSecret(ctx context.Context, owner, repo, name string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/secrets/%v", owner, repo, name)
	return s.deleteSecret(ctx, u)
}

func (s *CodespacesService) deleteSecret(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// ListSelectedReposForUserSecret lists the repositories that have been granted the ability to use a user's codespace secret.
//
// You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint.
// GitHub Apps must have read access to the codespaces_user_secrets user permission and write access to the codespaces_secrets repository permission on all referenced repositories to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#list-selected-repositories-for-a-user-secret
//
//meta:operation GET /user/codespaces/secrets/{secret_name}/repositories
func (s *CodespacesService) ListSelectedReposForUserSecret(ctx context.Context, name string, opts *ListOptions) (*SelectedReposList, *Response, error) {
	u := fmt.Sprintf("user/codespaces/secrets/%v/repositories", name)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	return s.listSelectedReposForSecret(ctx, u)
}

// ListSelectedReposForOrgSecret lists the repositories that have been granted the ability to use an organization's codespace secret.
//
// Lists all repositories that have been selected when the visibility for repository access to a secret is set to selected. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#list-selected-repositories-for-an-organization-secret
//
//meta:operation GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories
func (s *CodespacesService) ListSelectedReposForOrgSecret(ctx context.Context, org, name string, opts *ListOptions) (*SelectedReposList, *Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets/%v/repositories", org, name)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	return s.listSelectedReposForSecret(ctx, u)
}

func (s *CodespacesService) listSelectedReposForSecret(ctx context.Context, url string) (*SelectedReposList, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var repositories *SelectedReposList
	resp, err := s.client.Do(ctx, req, &repositories)
	if err != nil {
		return nil, resp, err
	}

	return repositories, resp, nil
}

// SetSelectedReposForUserSecret sets the repositories that have been granted the ability to use a user's codespace secret.
//
// You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint.
// GitHub Apps must have write access to the codespaces_user_secrets user permission and write access to the codespaces_secrets repository permission on all referenced repositories to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#set-selected-repositories-for-a-user-secret
//
//meta:operation PUT /user/codespaces/secrets/{secret_name}/repositories
func (s *CodespacesService) SetSelectedReposForUserSecret(ctx context.Context, name string, ids SelectedRepoIDs) (*Response, error) {
	u := fmt.Sprintf("user/codespaces/secrets/%v/repositories", name)
	return s.setSelectedRepoForSecret(ctx, u, ids)
}

// SetSelectedReposForOrgSecret sets the repositories that have been granted the ability to use a user's codespace secret.
//
// Replaces all repositories for an organization secret when the visibility for repository access is set to selected. The visibility is set when you Create or update an organization secret. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#set-selected-repositories-for-an-organization-secret
//
//meta:operation PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories
func (s *CodespacesService) SetSelectedReposForOrgSecret(ctx context.Context, org, name string, ids SelectedRepoIDs) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets/%v/repositories", org, name)
	return s.setSelectedRepoForSecret(ctx, u, ids)
}

func (s *CodespacesService) setSelectedRepoForSecret(ctx context.Context, url string, ids SelectedRepoIDs) (*Response, error) {
	type repoIDs struct {
		SelectedIDs SelectedRepoIDs `json:"selected_repository_ids"`
	}

	req, err := s.client.NewRequest("PUT", url, repoIDs{SelectedIDs: ids})
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// AddSelectedRepoToUserSecret adds a repository to the list of repositories that have been granted the ability to use a user's codespace secret.
//
// Adds a repository to the selected repositories for a user's codespace secret. You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint. GitHub Apps must have write access to the codespaces_user_secrets user permission and write access to the codespaces_secrets repository permission on the referenced repository to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#add-a-selected-repository-to-a-user-secret
//
//meta:operation PUT /user/codespaces/secrets/{secret_name}/repositories/{repository_id}
func (s *CodespacesService) AddSelectedRepoToUserSecret(ctx context.Context, name string, repo *Repository) (*Response, error) {
	u := fmt.Sprintf("user/codespaces/secrets/%v/repositories/%v", name, *repo.ID)
	return s.addSelectedRepoToSecret(ctx, u)
}

// AddSelectedRepoToOrgSecret adds a repository to the list of repositories that have been granted the ability to use an organization's codespace secret.
//
// Adds a repository to an organization secret when the visibility for repository access is set to selected. The visibility is set when you Create or update an organization secret. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#add-selected-repository-to-an-organization-secret
//
//meta:operation PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}
func (s *CodespacesService) AddSelectedRepoToOrgSecret(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets/%v/repositories/%v", org, name, *repo.ID)
	return s.addSelectedRepoToSecret(ctx, u)
}

func (s *CodespacesService) addSelectedRepoToSecret(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("PUT", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// RemoveSelectedRepoFromUserSecret removes a repository from the list of repositories that have been granted the ability to use a user's codespace secret.
//
// Removes a repository from the selected repositories for a user's codespace secret. You must authenticate using an access token with the codespace or codespace:secrets scope to use this endpoint. User must have Codespaces access to use this endpoint. GitHub Apps must have write access to the codespaces_user_secrets user permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/secrets#remove-a-selected-repository-from-a-user-secret
//
//meta:operation DELETE /user/codespaces/secrets/{secret_name}/repositories/{repository_id}
func (s *CodespacesService) RemoveSelectedRepoFromUserSecret(ctx context.Context, name string, repo *Repository) (*Response, error) {
	u := fmt.Sprintf("user/codespaces/secrets/%v/repositories/%v", name, *repo.ID)
	return s.removeSelectedRepoFromSecret(ctx, u)
}

// RemoveSelectedRepoFromOrgSecret removes a repository from the list of repositories that have been granted the ability to use an organization's codespace secret.
//
// Removes a repository from an organization secret when the visibility for repository access is set to selected. The visibility is set when you Create or update an organization secret. You must authenticate using an access token with the admin:org scope to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organization-secrets#remove-selected-repository-from-an-organization-secret
//
//meta:operation DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}
func (s *CodespacesService) RemoveSelectedRepoFromOrgSecret(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/secrets/%v/repositories/%v", org, name, *repo.ID)
	return s.removeSelectedRepoFromSecret(ctx, u)
}

func (s *CodespacesService) removeSelectedRepoFromSecret(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}
