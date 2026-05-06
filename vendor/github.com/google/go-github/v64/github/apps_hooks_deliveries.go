// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ListHookDeliveries lists deliveries of an App webhook.
//
// GitHub API docs: https://docs.github.com/rest/apps/webhooks#list-deliveries-for-an-app-webhook
//
//meta:operation GET /app/hook/deliveries
func (s *AppsService) ListHookDeliveries(ctx context.Context, opts *ListCursorOptions) ([]*HookDelivery, *Response, error) {
	u, err := addOptions("app/hook/deliveries", opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	deliveries := []*HookDelivery{}
	resp, err := s.client.Do(ctx, req, &deliveries)
	if err != nil {
		return nil, resp, err
	}

	return deliveries, resp, nil
}

// GetHookDelivery returns the App webhook delivery with the specified ID.
//
// GitHub API docs: https://docs.github.com/rest/apps/webhooks#get-a-delivery-for-an-app-webhook
//
//meta:operation GET /app/hook/deliveries/{delivery_id}
func (s *AppsService) GetHookDelivery(ctx context.Context, deliveryID int64) (*HookDelivery, *Response, error) {
	u := fmt.Sprintf("app/hook/deliveries/%v", deliveryID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	h := new(HookDelivery)
	resp, err := s.client.Do(ctx, req, h)
	if err != nil {
		return nil, resp, err
	}

	return h, resp, nil
}

// RedeliverHookDelivery redelivers a delivery for an App webhook.
//
// GitHub API docs: https://docs.github.com/rest/apps/webhooks#redeliver-a-delivery-for-an-app-webhook
//
//meta:operation POST /app/hook/deliveries/{delivery_id}/attempts
func (s *AppsService) RedeliverHookDelivery(ctx context.Context, deliveryID int64) (*HookDelivery, *Response, error) {
	u := fmt.Sprintf("app/hook/deliveries/%v/attempts", deliveryID)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, nil, err
	}

	h := new(HookDelivery)
	resp, err := s.client.Do(ctx, req, h)
	if err != nil {
		return nil, resp, err
	}

	return h, resp, nil
}
