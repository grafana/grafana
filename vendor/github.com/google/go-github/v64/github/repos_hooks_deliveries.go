// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
)

// HookDelivery represents the data that is received from GitHub's Webhook Delivery API
//
// GitHub API docs:
// - https://docs.github.com/rest/webhooks/repo-deliveries#list-deliveries-for-a-repository-webhook
// - https://docs.github.com/rest/webhooks/repo-deliveries#get-a-delivery-for-a-repository-webhook
type HookDelivery struct {
	ID             *int64     `json:"id,omitempty"`
	GUID           *string    `json:"guid,omitempty"`
	DeliveredAt    *Timestamp `json:"delivered_at,omitempty"`
	Redelivery     *bool      `json:"redelivery,omitempty"`
	Duration       *float64   `json:"duration,omitempty"`
	Status         *string    `json:"status,omitempty"`
	StatusCode     *int       `json:"status_code,omitempty"`
	Event          *string    `json:"event,omitempty"`
	Action         *string    `json:"action,omitempty"`
	InstallationID *int64     `json:"installation_id,omitempty"`
	RepositoryID   *int64     `json:"repository_id,omitempty"`

	// Request is populated by GetHookDelivery.
	Request *HookRequest `json:"request,omitempty"`
	// Response is populated by GetHookDelivery.
	Response *HookResponse `json:"response,omitempty"`
}

func (d HookDelivery) String() string {
	return Stringify(d)
}

// HookRequest is a part of HookDelivery that contains
// the HTTP headers and the JSON payload of the webhook request.
type HookRequest struct {
	Headers    map[string]string `json:"headers,omitempty"`
	RawPayload *json.RawMessage  `json:"payload,omitempty"`
}

func (r HookRequest) String() string {
	return Stringify(r)
}

// HookResponse is a part of HookDelivery that contains
// the HTTP headers and the response body served by the webhook endpoint.
type HookResponse struct {
	Headers    map[string]string `json:"headers,omitempty"`
	RawPayload *json.RawMessage  `json:"payload,omitempty"`
}

func (r HookResponse) String() string {
	return Stringify(r)
}

// ListHookDeliveries lists webhook deliveries for a webhook configured in a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#list-deliveries-for-a-repository-webhook
//
//meta:operation GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries
func (s *RepositoriesService) ListHookDeliveries(ctx context.Context, owner, repo string, id int64, opts *ListCursorOptions) ([]*HookDelivery, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%v/deliveries", owner, repo, id)
	u, err := addOptions(u, opts)
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

// GetHookDelivery returns a delivery for a webhook configured in a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#get-a-delivery-for-a-repository-webhook
//
//meta:operation GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}
func (s *RepositoriesService) GetHookDelivery(ctx context.Context, owner, repo string, hookID, deliveryID int64) (*HookDelivery, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%v/deliveries/%v", owner, repo, hookID, deliveryID)
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

// RedeliverHookDelivery redelivers a delivery for a webhook configured in a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#redeliver-a-delivery-for-a-repository-webhook
//
//meta:operation POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts
func (s *RepositoriesService) RedeliverHookDelivery(ctx context.Context, owner, repo string, hookID, deliveryID int64) (*HookDelivery, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%v/deliveries/%v/attempts", owner, repo, hookID, deliveryID)
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

// ParseRequestPayload parses the request payload. For recognized event types,
// a value of the corresponding struct type will be returned.
func (d *HookDelivery) ParseRequestPayload() (interface{}, error) {
	eType, ok := messageToTypeName[d.GetEvent()]
	if !ok {
		return nil, fmt.Errorf("unsupported event type %q", d.GetEvent())
	}

	e := &Event{Type: &eType, RawPayload: d.Request.RawPayload}
	return e.ParsePayload()
}
