package gapi

import (
	"encoding/json"
	"fmt"
)

// Org represents a Grafana org.
type Org struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// Orgs fetches and returns the Grafana orgs.
func (c *Client) Orgs() ([]Org, error) {
	orgs := make([]Org, 0)
	err := c.request("GET", "/api/orgs/", nil, nil, &orgs)
	if err != nil {
		return orgs, err
	}

	return orgs, err
}

// OrgByName fetches and returns the org whose name it's passed.
func (c *Client) OrgByName(name string) (Org, error) {
	org := Org{}
	err := c.request("GET", fmt.Sprintf("/api/orgs/name/%s", name), nil, nil, &org)
	if err != nil {
		return org, err
	}

	return org, err
}

// Org fetches and returns the org whose ID it's passed.
func (c *Client) Org(id int64) (Org, error) {
	org := Org{}
	err := c.request("GET", fmt.Sprintf("/api/orgs/%d", id), nil, nil, &org)
	if err != nil {
		return org, err
	}

	return org, err
}

// NewOrg creates a new Grafana org.
func (c *Client) NewOrg(name string) (int64, error) {
	id := int64(0)

	dataMap := map[string]string{
		"name": name,
	}
	data, err := json.Marshal(dataMap)
	if err != nil {
		return id, err
	}
	tmp := struct {
		ID int64 `json:"orgId"`
	}{}

	err = c.request("POST", "/api/orgs", nil, data, &tmp)
	if err != nil {
		return id, err
	}

	return tmp.ID, err
}

// UpdateOrg updates a Grafana org.
func (c *Client) UpdateOrg(id int64, name string) error {
	dataMap := map[string]string{
		"name": name,
	}
	data, err := json.Marshal(dataMap)
	if err != nil {
		return err
	}

	return c.request("PUT", fmt.Sprintf("/api/orgs/%d", id), nil, data, nil)
}

// DeleteOrg deletes the Grafana org whose ID it's passed.
func (c *Client) DeleteOrg(id int64) error {
	return c.request("DELETE", fmt.Sprintf("/api/orgs/%d", id), nil, nil, nil)
}
