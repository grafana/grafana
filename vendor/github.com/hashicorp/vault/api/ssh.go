// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"fmt"
	"net/http"
)

// SSH is used to return a client to invoke operations on SSH backend.
type SSH struct {
	c          *Client
	MountPoint string
}

// SSH returns the client for logical-backend API calls.
func (c *Client) SSH() *SSH {
	return c.SSHWithMountPoint(SSHHelperDefaultMountPoint)
}

// SSHWithMountPoint returns the client with specific SSH mount point.
func (c *Client) SSHWithMountPoint(mountPoint string) *SSH {
	return &SSH{
		c:          c,
		MountPoint: mountPoint,
	}
}

// Credential wraps CredentialWithContext using context.Background.
func (c *SSH) Credential(role string, data map[string]interface{}) (*Secret, error) {
	return c.CredentialWithContext(context.Background(), role, data)
}

// CredentialWithContext invokes the SSH backend API to create a credential to establish an SSH session.
func (c *SSH) CredentialWithContext(ctx context.Context, role string, data map[string]interface{}) (*Secret, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPut, fmt.Sprintf("/v1/%s/creds/%s", c.MountPoint, role))
	if err := r.SetJSONBody(data); err != nil {
		return nil, err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return ParseSecret(resp.Body)
}

// SignKey wraps SignKeyWithContext using context.Background.
func (c *SSH) SignKey(role string, data map[string]interface{}) (*Secret, error) {
	return c.SignKeyWithContext(context.Background(), role, data)
}

// SignKeyWithContext signs the given public key and returns a signed public key to pass
// along with the SSH request.
func (c *SSH) SignKeyWithContext(ctx context.Context, role string, data map[string]interface{}) (*Secret, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPut, fmt.Sprintf("/v1/%s/sign/%s", c.MountPoint, role))
	if err := r.SetJSONBody(data); err != nil {
		return nil, err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return ParseSecret(resp.Body)
}
