package gapi

import (
	"encoding/json"
	"fmt"
	"net/url"
)

// ContactPoint represents a Grafana Alerting contact point.
type ContactPoint struct {
	UID                   string                 `json:"uid"`
	Name                  string                 `json:"name"`
	Type                  string                 `json:"type"`
	Settings              map[string]interface{} `json:"settings"`
	DisableResolveMessage bool                   `json:"disableResolveMessage"`
	Provenance            string                 `json:"provenance"`
}

// ContactPoints fetches all contact points.
func (c *Client) ContactPoints() ([]ContactPoint, error) {
	ps := make([]ContactPoint, 0)
	err := c.request("GET", "/api/v1/provisioning/contact-points", nil, nil, &ps)
	if err != nil {
		return nil, err
	}
	return ps, nil
}

// ContactPointsByName fetches contact points with the given name.
func (c *Client) ContactPointsByName(name string) ([]ContactPoint, error) {
	ps := make([]ContactPoint, 0)
	params := url.Values{}
	params.Add("name", name)
	err := c.request("GET", "/api/v1/provisioning/contact-points", params, nil, &ps)
	if err != nil {
		return nil, err
	}
	return ps, nil
}

// ContactPoint fetches a single contact point, identified by its UID.
func (c *Client) ContactPoint(uid string) (ContactPoint, error) {
	ps, err := c.ContactPoints()
	if err != nil {
		return ContactPoint{}, err
	}

	for _, p := range ps {
		if p.UID == uid {
			return p, nil
		}
	}
	return ContactPoint{}, fmt.Errorf("contact point with uid %s not found", uid)
}

// NewContactPoint creates a new contact point.
func (c *Client) NewContactPoint(p *ContactPoint) (string, error) {
	req, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	result := ContactPoint{}

	err = c.request("POST", "/api/v1/provisioning/contact-points", nil, req, &result)
	if err != nil {
		return "", err
	}
	return result.UID, nil
}

// UpdateContactPoint replaces a contact point, identified by contact point's UID.
func (c *Client) UpdateContactPoint(p *ContactPoint) error {
	uri := fmt.Sprintf("/api/v1/provisioning/contact-points/%s", p.UID)
	req, err := json.Marshal(p)
	if err != nil {
		return err
	}

	return c.request("PUT", uri, nil, req, nil)
}

// DeleteContactPoint deletes a contact point.
func (c *Client) DeleteContactPoint(uid string) error {
	uri := fmt.Sprintf("/api/v1/provisioning/contact-points/%s", uid)
	return c.request("DELETE", uri, nil, nil, nil)
}
