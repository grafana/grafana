package gapi

import (
	"fmt"
	"time"
)

type CloudOrg struct {
	ID        int64     `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (c *Client) GetCloudOrg(org string) (CloudOrg, error) {
	resp := CloudOrg{}
	err := c.request("GET", fmt.Sprintf("/api/orgs/%s", org), nil, nil, &resp)
	return resp, err
}
