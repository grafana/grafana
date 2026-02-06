// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"fmt"
	"net/http"
)

func (c *Sys) MFAValidate(requestID string, payload map[string]interface{}) (*Secret, error) {
	return c.MFAValidateWithContext(context.Background(), requestID, payload)
}

func (c *Sys) MFAValidateWithContext(ctx context.Context, requestID string, payload map[string]interface{}) (*Secret, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]interface{}{
		"mfa_request_id": requestID,
		"mfa_payload":    payload,
	}

	r := c.c.NewRequest(http.MethodPost, fmt.Sprintf("/v1/sys/mfa/validate"))
	if err := r.SetJSONBody(body); err != nil {
		return nil, fmt.Errorf("failed to set request body: %w", err)
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return nil, err
	}

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse secret from response: %w", err)
	}

	if secret == nil {
		return nil, fmt.Errorf("data from server response is empty")
	}

	return secret, nil
}
