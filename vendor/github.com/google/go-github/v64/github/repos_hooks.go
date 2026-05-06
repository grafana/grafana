// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// WebHookPayload represents the data that is received from GitHub when a push
// event hook is triggered. The format of these payloads pre-date most of the
// GitHub v3 API, so there are lots of minor incompatibilities with the types
// defined in the rest of the API. Therefore, several types are duplicated
// here to account for these differences.
//
// GitHub API docs: https://help.github.com/articles/post-receive-hooks
//
// Deprecated: Please use PushEvent instead.
type WebHookPayload = PushEvent

// WebHookCommit represents the commit variant we receive from GitHub in a
// WebHookPayload.
//
// Deprecated: Please use HeadCommit instead.
type WebHookCommit = HeadCommit

// WebHookAuthor represents the author or committer of a commit, as specified
// in a WebHookCommit. The commit author may not correspond to a GitHub User.
//
// Deprecated: Please use CommitAuthor instead.
// NOTE Breaking API change: the `Username` field is now called `Login`.
type WebHookAuthor = CommitAuthor

// Hook represents a GitHub (web and service) hook for a repository.
type Hook struct {
	CreatedAt    *Timestamp             `json:"created_at,omitempty"`
	UpdatedAt    *Timestamp             `json:"updated_at,omitempty"`
	URL          *string                `json:"url,omitempty"`
	ID           *int64                 `json:"id,omitempty"`
	Type         *string                `json:"type,omitempty"`
	Name         *string                `json:"name,omitempty"`
	TestURL      *string                `json:"test_url,omitempty"`
	PingURL      *string                `json:"ping_url,omitempty"`
	LastResponse map[string]interface{} `json:"last_response,omitempty"`

	// Only the following fields are used when creating a hook.
	// Config is required.
	Config *HookConfig `json:"config,omitempty"`
	Events []string    `json:"events,omitempty"`
	Active *bool       `json:"active,omitempty"`
}

func (h Hook) String() string {
	return Stringify(h)
}

// createHookRequest is a subset of Hook and is used internally
// by CreateHook to pass only the known fields for the endpoint.
//
// See https://github.com/google/go-github/issues/1015 for more
// information.
type createHookRequest struct {
	// Config is required.
	Name   string      `json:"name"`
	Config *HookConfig `json:"config,omitempty"`
	Events []string    `json:"events,omitempty"`
	Active *bool       `json:"active,omitempty"`
}

// CreateHook creates a Hook for the specified repository.
// Config is a required field.
//
// Note that only a subset of the hook fields are used and hook must
// not be nil.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#create-a-repository-webhook
//
//meta:operation POST /repos/{owner}/{repo}/hooks
func (s *RepositoriesService) CreateHook(ctx context.Context, owner, repo string, hook *Hook) (*Hook, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks", owner, repo)

	hookReq := &createHookRequest{
		Name:   "web",
		Events: hook.Events,
		Active: hook.Active,
		Config: hook.Config,
	}

	req, err := s.client.NewRequest("POST", u, hookReq)
	if err != nil {
		return nil, nil, err
	}

	h := new(Hook)
	resp, err := s.client.Do(ctx, req, h)
	if err != nil {
		return nil, resp, err
	}

	return h, resp, nil
}

// ListHooks lists all Hooks for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#list-repository-webhooks
//
//meta:operation GET /repos/{owner}/{repo}/hooks
func (s *RepositoriesService) ListHooks(ctx context.Context, owner, repo string, opts *ListOptions) ([]*Hook, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var hooks []*Hook
	resp, err := s.client.Do(ctx, req, &hooks)
	if err != nil {
		return nil, resp, err
	}

	return hooks, resp, nil
}

// GetHook returns a single specified Hook.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#get-a-repository-webhook
//
//meta:operation GET /repos/{owner}/{repo}/hooks/{hook_id}
func (s *RepositoriesService) GetHook(ctx context.Context, owner, repo string, id int64) (*Hook, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%d", owner, repo, id)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}
	h := new(Hook)
	resp, err := s.client.Do(ctx, req, h)
	if err != nil {
		return nil, resp, err
	}

	return h, resp, nil
}

// EditHook updates a specified Hook.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#update-a-repository-webhook
//
//meta:operation PATCH /repos/{owner}/{repo}/hooks/{hook_id}
func (s *RepositoriesService) EditHook(ctx context.Context, owner, repo string, id int64, hook *Hook) (*Hook, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%d", owner, repo, id)
	req, err := s.client.NewRequest("PATCH", u, hook)
	if err != nil {
		return nil, nil, err
	}
	h := new(Hook)
	resp, err := s.client.Do(ctx, req, h)
	if err != nil {
		return nil, resp, err
	}

	return h, resp, nil
}

// DeleteHook deletes a specified Hook.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#delete-a-repository-webhook
//
//meta:operation DELETE /repos/{owner}/{repo}/hooks/{hook_id}
func (s *RepositoriesService) DeleteHook(ctx context.Context, owner, repo string, id int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%d", owner, repo, id)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}

// PingHook triggers a 'ping' event to be sent to the Hook.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#ping-a-repository-webhook
//
//meta:operation POST /repos/{owner}/{repo}/hooks/{hook_id}/pings
func (s *RepositoriesService) PingHook(ctx context.Context, owner, repo string, id int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%d/pings", owner, repo, id)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}

// TestHook triggers a test Hook by github.
//
// GitHub API docs: https://docs.github.com/rest/repos/webhooks#test-the-push-repository-webhook
//
//meta:operation POST /repos/{owner}/{repo}/hooks/{hook_id}/tests
func (s *RepositoriesService) TestHook(ctx context.Context, owner, repo string, id int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/hooks/%d/tests", owner, repo, id)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}

// Subscribe lets servers register to receive updates when a topic is updated.
//
// GitHub API docs: https://docs.github.com/webhooks/about-webhooks-for-repositories#pubsubhubbub
//
//meta:operation POST /hub
func (s *RepositoriesService) Subscribe(ctx context.Context, owner, repo, event, callback string, secret []byte) (*Response, error) {
	req, err := s.createWebSubRequest("subscribe", owner, repo, event, callback, secret)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// Unsubscribe lets servers unregister to no longer receive updates when a topic is updated.
//
// GitHub API docs: https://docs.github.com/webhooks/about-webhooks-for-repositories#pubsubhubbub
//
//meta:operation POST /hub
func (s *RepositoriesService) Unsubscribe(ctx context.Context, owner, repo, event, callback string, secret []byte) (*Response, error) {
	req, err := s.createWebSubRequest("unsubscribe", owner, repo, event, callback, secret)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// createWebSubRequest returns a subscribe/unsubscribe request that implements
// the WebSub (formerly PubSubHubbub) protocol.
//
// See: https://www.w3.org/TR/websub/#subscriber-sends-subscription-request
func (s *RepositoriesService) createWebSubRequest(hubMode, owner, repo, event, callback string, secret []byte) (*http.Request, error) {
	topic := fmt.Sprintf(
		"https://github.com/%s/%s/events/%s",
		owner,
		repo,
		event,
	)
	form := url.Values{}
	form.Add("hub.mode", hubMode)
	form.Add("hub.topic", topic)
	form.Add("hub.callback", callback)
	if secret != nil {
		form.Add("hub.secret", string(secret))
	}
	body := strings.NewReader(form.Encode())

	req, err := s.client.NewFormRequest("hub", body)
	if err != nil {
		return nil, err
	}

	return req, nil
}
