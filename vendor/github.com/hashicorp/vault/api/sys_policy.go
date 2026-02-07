// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/mitchellh/mapstructure"
)

func (c *Sys) ListPolicies() ([]string, error) {
	return c.ListPoliciesWithContext(context.Background())
}

func (c *Sys) ListPoliciesWithContext(ctx context.Context) ([]string, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest("LIST", "/v1/sys/policies/acl")
	// Set this for broader compatibility, but we use LIST above to be able to
	// handle the wrapping lookup function
	r.Method = http.MethodGet
	r.Params.Set("list", "true")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result []string
	err = mapstructure.Decode(secret.Data["keys"], &result)
	if err != nil {
		return nil, err
	}

	return result, err
}

func (c *Sys) GetPolicy(name string) (string, error) {
	return c.GetPolicyWithContext(context.Background(), name)
}

func (c *Sys) GetPolicyWithContext(ctx context.Context, name string) (string, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, fmt.Sprintf("/v1/sys/policies/acl/%s", name))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if resp != nil {
		defer resp.Body.Close()
		if resp.StatusCode == 404 {
			return "", nil
		}
	}
	if err != nil {
		return "", err
	}

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return "", err
	}
	if secret == nil || secret.Data == nil {
		return "", errors.New("data from server response is empty")
	}

	if policyRaw, ok := secret.Data["policy"]; ok {
		return policyRaw.(string), nil
	}

	return "", fmt.Errorf("no policy found in response")
}

func (c *Sys) PutPolicy(name, rules string) error {
	return c.PutPolicyWithContext(context.Background(), name, rules)
}

func (c *Sys) PutPolicyWithContext(ctx context.Context, name, rules string) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]string{
		"policy": rules,
	}

	r := c.c.NewRequest(http.MethodPut, fmt.Sprintf("/v1/sys/policies/acl/%s", name))
	if err := r.SetJSONBody(body); err != nil {
		return err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *Sys) DeletePolicy(name string) error {
	return c.DeletePolicyWithContext(context.Background(), name)
}

func (c *Sys) DeletePolicyWithContext(ctx context.Context, name string) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodDelete, fmt.Sprintf("/v1/sys/policies/acl/%s", name))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

type getPoliciesResp struct {
	Rules string `json:"rules"`
}

type listPoliciesResp struct {
	Policies []string `json:"policies"`
}
