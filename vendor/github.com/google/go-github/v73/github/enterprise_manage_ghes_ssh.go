// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
)

// SSHKeyStatus represents the status of a SSH key operation.
type SSHKeyStatus struct {
	Hostname *string `json:"hostname,omitempty"`
	UUID     *string `json:"uuid,omitempty"`
	Message  *string `json:"message,omitempty"`
	Modified *bool   `json:"modified,omitempty"`
}

// SSHKeyOptions specifies the parameters to the SSH create and delete functions.
type SSHKeyOptions struct {
	// Key is the SSH key to add to the instance.
	Key string `json:"key"`
}

// ClusterSSHKey represents the SSH keys configured for the instance.
type ClusterSSHKey struct {
	Key         *string `json:"key,omitempty"`
	Fingerprint *string `json:"fingerprint,omitempty"`
}

// DeleteSSHKey deletes the SSH key from the instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#delete-a-ssh-key
//
//meta:operation DELETE /manage/v1/access/ssh
func (s *EnterpriseService) DeleteSSHKey(ctx context.Context, key string) ([]*SSHKeyStatus, *Response, error) {
	u := "manage/v1/access/ssh"
	opts := &SSHKeyOptions{
		Key: key,
	}
	req, err := s.client.NewRequest("DELETE", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var sshStatus []*SSHKeyStatus
	resp, err := s.client.Do(ctx, req, &sshStatus)
	if err != nil {
		return nil, resp, err
	}

	return sshStatus, resp, nil
}

// GetSSHKey gets the SSH keys configured for the instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-the-configured-ssh-keys
//
//meta:operation GET /manage/v1/access/ssh
func (s *EnterpriseService) GetSSHKey(ctx context.Context) ([]*ClusterSSHKey, *Response, error) {
	u := "manage/v1/access/ssh"
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var sshKeys []*ClusterSSHKey
	resp, err := s.client.Do(ctx, req, &sshKeys)
	if err != nil {
		return nil, resp, err
	}

	return sshKeys, resp, nil
}

// CreateSSHKey adds a new SSH key to the instance.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#set-a-new-ssh-key
//
//meta:operation POST /manage/v1/access/ssh
func (s *EnterpriseService) CreateSSHKey(ctx context.Context, key string) ([]*SSHKeyStatus, *Response, error) {
	u := "manage/v1/access/ssh"
	opts := &SSHKeyOptions{
		Key: key,
	}
	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var sshKeyResponse []*SSHKeyStatus
	resp, err := s.client.Do(ctx, req, &sshKeyResponse)
	if err != nil {
		return nil, resp, err
	}

	return sshKeyResponse, resp, nil
}
