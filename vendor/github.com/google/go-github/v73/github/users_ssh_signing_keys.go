// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// SSHSigningKey represents a public SSH key used to sign git commits.
type SSHSigningKey struct {
	ID        *int64     `json:"id,omitempty"`
	Key       *string    `json:"key,omitempty"`
	Title     *string    `json:"title,omitempty"`
	CreatedAt *Timestamp `json:"created_at,omitempty"`
}

func (k SSHSigningKey) String() string {
	return Stringify(k)
}

// ListSSHSigningKeys lists the SSH signing keys for a user. Passing an empty
// username string will fetch SSH signing keys for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/users/ssh-signing-keys#list-ssh-signing-keys-for-a-user
// GitHub API docs: https://docs.github.com/rest/users/ssh-signing-keys#list-ssh-signing-keys-for-the-authenticated-user
//
//meta:operation GET /user/ssh_signing_keys
//meta:operation GET /users/{username}/ssh_signing_keys
func (s *UsersService) ListSSHSigningKeys(ctx context.Context, user string, opts *ListOptions) ([]*SSHSigningKey, *Response, error) {
	var u string
	if user != "" {
		u = fmt.Sprintf("users/%v/ssh_signing_keys", user)
	} else {
		u = "user/ssh_signing_keys"
	}
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var keys []*SSHSigningKey
	resp, err := s.client.Do(ctx, req, &keys)
	if err != nil {
		return nil, resp, err
	}

	return keys, resp, nil
}

// GetSSHSigningKey fetches a single SSH signing key for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/users/ssh-signing-keys#get-an-ssh-signing-key-for-the-authenticated-user
//
//meta:operation GET /user/ssh_signing_keys/{ssh_signing_key_id}
func (s *UsersService) GetSSHSigningKey(ctx context.Context, id int64) (*SSHSigningKey, *Response, error) {
	u := fmt.Sprintf("user/ssh_signing_keys/%v", id)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	key := new(SSHSigningKey)
	resp, err := s.client.Do(ctx, req, key)
	if err != nil {
		return nil, resp, err
	}

	return key, resp, nil
}

// CreateSSHSigningKey adds a SSH signing key for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/users/ssh-signing-keys#create-a-ssh-signing-key-for-the-authenticated-user
//
//meta:operation POST /user/ssh_signing_keys
func (s *UsersService) CreateSSHSigningKey(ctx context.Context, key *Key) (*SSHSigningKey, *Response, error) {
	u := "user/ssh_signing_keys"

	req, err := s.client.NewRequest("POST", u, key)
	if err != nil {
		return nil, nil, err
	}

	k := new(SSHSigningKey)
	resp, err := s.client.Do(ctx, req, k)
	if err != nil {
		return nil, resp, err
	}

	return k, resp, nil
}

// DeleteSSHSigningKey deletes a SSH signing key for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/users/ssh-signing-keys#delete-an-ssh-signing-key-for-the-authenticated-user
//
//meta:operation DELETE /user/ssh_signing_keys/{ssh_signing_key_id}
func (s *UsersService) DeleteSSHSigningKey(ctx context.Context, id int64) (*Response, error) {
	u := fmt.Sprintf("user/ssh_signing_keys/%v", id)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
