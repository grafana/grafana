// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
)

const (
	// baseEndpoint is the common base URL path for all endpoints used in this
	// module.
	baseEndpoint string = "/v1/sys/config/ui/custom-messages"
)

// ListUICustomMessages calls ListUICustomMessagesWithContext using a background
// Context.
func (c *Sys) ListUICustomMessages(req UICustomMessageListRequest) (*Secret, error) {
	return c.ListUICustomMessagesWithContext(context.Background(), req)
}

// ListUICustomMessagesWithContext sends a request to the List custom messages
// endpoint using the provided Context and UICustomMessageListRequest value as
// the inputs. It returns a pointer to a Secret if a response was obtained from
// the server, including error responses; or an error if a response could not be
// obtained due to an error.
func (c *Sys) ListUICustomMessagesWithContext(ctx context.Context, req UICustomMessageListRequest) (*Secret, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest("LIST", fmt.Sprintf("%s/", baseEndpoint))
	if req.Active != nil {
		r.Params.Add("active", strconv.FormatBool(*req.Active))
	}
	if req.Authenticated != nil {
		r.Params.Add("authenticated", strconv.FormatBool(*req.Authenticated))
	}
	if req.Type != nil {
		r.Params.Add("type", *req.Type)
	}

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

	return secret, nil
}

// CreateUICustomMessage calls CreateUICustomMessageWithContext using a
// background Context.
func (c *Sys) CreateUICustomMessage(req UICustomMessageRequest) (*Secret, error) {
	return c.CreateUICustomMessageWithContext(context.Background(), req)
}

// CreateUICustomMessageWithContext sends a request to the Create custom
// messages endpoint using the provided Context and UICustomMessageRequest
// values as the inputs. It returns a pointer to a Secret if a response was
// obtained from the server, including error responses; or an error if a
// response could not be obtained due to an error.
func (c *Sys) CreateUICustomMessageWithContext(ctx context.Context, req UICustomMessageRequest) (*Secret, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPost, baseEndpoint)
	if err := r.SetJSONBody(&req); err != nil {
		return nil, fmt.Errorf("error encoding request body to json: %w", err)
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, fmt.Errorf("error sending request to server: %w", err)
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("could not parse secret from server response: %w", err)
	}

	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	return secret, nil
}

// ReadUICustomMessage calls ReadUICustomMessageWithContext using a background
// Context.
func (c *Sys) ReadUICustomMessage(id string) (*Secret, error) {
	return c.ReadUICustomMessageWithContext(context.Background(), id)
}

// ReadUICustomMessageWithContext sends a request to the Read custom message
// endpoint using the provided Context and id values. It returns a pointer to a
// Secret if a response was obtained from the server, including error responses;
// or an error if a response could not be obtained due to an error.
func (c *Sys) ReadUICustomMessageWithContext(ctx context.Context, id string) (*Secret, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, fmt.Sprintf("%s/%s", baseEndpoint, id))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, fmt.Errorf("error sending request to server: %w", err)
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("could not parse secret from server response: %w", err)
	}

	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	return secret, nil
}

// UpdateUICustomMessage calls UpdateUICustomMessageWithContext using a
// background Context.
func (c *Sys) UpdateUICustomMessage(id string, req UICustomMessageRequest) error {
	return c.UpdateUICustomMessageWithContext(context.Background(), id, req)
}

// UpdateUICustomMessageWithContext sends a request to the Update custom message
// endpoint using the provided Context, id, and UICustomMessageRequest values.
// It returns a pointer to a Secret if a response was obtained from the server,
// including error responses; or an error if a response could not be obtained
// due to an error.
func (c *Sys) UpdateUICustomMessageWithContext(ctx context.Context, id string, req UICustomMessageRequest) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPost, fmt.Sprintf("%s/%s", baseEndpoint, id))
	if err := r.SetJSONBody(&req); err != nil {
		return fmt.Errorf("error encoding request body to json: %w", err)
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return fmt.Errorf("error sending request to server: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// DeleteUICustomMessage calls DeleteUICustomMessageWithContext using a
// background Context.
func (c *Sys) DeleteUICustomMessage(id string) error {
	return c.DeletePolicyWithContext(context.Background(), id)
}

// DeleteUICustomMessageWithContext sends a request to the Delete custom message
// endpoint using the provided Context and id values. It returns a pointer to a
// Secret if a response was obtained from the server, including error responses;
// or an error if a response could not be obtained due to an error.
func (c *Sys) DeleteUICustomMessageWithContext(ctx context.Context, id string) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodDelete, fmt.Sprintf("%s/%s", baseEndpoint, id))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return fmt.Errorf("error sending request to server: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// UICustomMessageListRequest is a struct used to contain inputs for the List
// custom messages request. Each field is optional, so their types are pointers.
// The With... methods can be used to easily set the fields with pointers to
// values.
type UICustomMessageListRequest struct {
	Authenticated *bool
	Type          *string
	Active        *bool
}

// WithAuthenticated sets the Authenticated field to a pointer referencing the
// provided bool value.
func (r *UICustomMessageListRequest) WithAuthenticated(value bool) *UICustomMessageListRequest {
	r.Authenticated = &value

	return r
}

// WithType sets the Type field to a pointer referencing the provided string
// value.
func (r *UICustomMessageListRequest) WithType(value string) *UICustomMessageListRequest {
	r.Type = &value

	return r
}

// WithActive sets the Active field to a pointer referencing the provided bool
// value.
func (r *UICustomMessageListRequest) WithActive(value bool) *UICustomMessageListRequest {
	r.Active = &value

	return r
}

// UICustomMessageRequest is a struct containing the properties of a custom
// message. The Link field can be set using the WithLink method.
type UICustomMessageRequest struct {
	Title         string               `json:"title"`
	Message       string               `json:"message"`
	Authenticated bool                 `json:"authenticated"`
	Type          string               `json:"type"`
	StartTime     string               `json:"start_time"`
	EndTime       string               `json:"end_time,omitempty"`
	Link          *uiCustomMessageLink `json:"link,omitempty"`
	Options       map[string]any       `json:"options,omitempty"`
}

// WithLink sets the Link field to the address of a new uiCustomMessageLink
// struct constructed from the provided title and href values.
func (r *UICustomMessageRequest) WithLink(title, href string) *UICustomMessageRequest {
	r.Link = &uiCustomMessageLink{
		Title: title,
		Href:  href,
	}

	return r
}

// uiCustomMessageLink is a utility struct used to represent a link associated
// with a custom message.
type uiCustomMessageLink struct {
	Title string
	Href  string
}

// MarshalJSON encodes the state of the receiver uiCustomMessageLink as JSON and
// returns those encoded bytes or an error.
func (l uiCustomMessageLink) MarshalJSON() ([]byte, error) {
	m := make(map[string]string)

	m[l.Title] = l.Href

	return json.Marshal(m)
}

// UnmarshalJSON updates the state of the receiver uiCustomMessageLink from the
// provided JSON encoded bytes. It returns an error if there was a failure.
func (l *uiCustomMessageLink) UnmarshalJSON(b []byte) error {
	m := make(map[string]string)

	if err := json.Unmarshal(b, &m); err != nil {
		return err
	}

	for k, v := range m {
		l.Title = k
		l.Href = v
		break
	}

	return nil
}
