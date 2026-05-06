package gapi

import (
	"encoding/json"
	"fmt"
)

// AlertingMessageTemplate is a re-usable template for Grafana Alerting messages.
type AlertingMessageTemplate struct {
	Name     string `json:"name"`
	Template string `json:"template"`
}

// MessageTemplates fetches all message templates.
func (c *Client) MessageTemplates() ([]AlertingMessageTemplate, error) {
	ts := make([]AlertingMessageTemplate, 0)
	err := c.request("GET", "/api/v1/provisioning/templates", nil, nil, &ts)
	if err != nil {
		return nil, err
	}
	return ts, nil
}

// MessageTemplate fetches a single message template, identified by its name.
func (c *Client) MessageTemplate(name string) (*AlertingMessageTemplate, error) {
	t := AlertingMessageTemplate{}
	uri := fmt.Sprintf("/api/v1/provisioning/templates/%s", name)
	err := c.request("GET", uri, nil, nil, &t)
	if err != nil {
		return nil, err
	}
	return &t, err
}

// SetMessageTemplate creates or updates a message template.
func (c *Client) SetMessageTemplate(name, content string) error {
	req := struct {
		Template string `json:"template"`
	}{Template: content}
	body, err := json.Marshal(req)
	if err != nil {
		return err
	}

	uri := fmt.Sprintf("/api/v1/provisioning/templates/%s", name)
	return c.request("PUT", uri, nil, body, nil)
}

// DeleteMessageTemplate deletes a message template.
func (c *Client) DeleteMessageTemplate(name string) error {
	uri := fmt.Sprintf("/api/v1/provisioning/templates/%s", name)
	return c.request("DELETE", uri, nil, nil, nil)
}
