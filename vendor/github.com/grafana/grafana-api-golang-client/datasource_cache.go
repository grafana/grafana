package gapi

import (
	"encoding/json"
	"fmt"
)

type DatasourceCache struct {
	Message        string `json:"message"`
	DatasourceID   int64  `json:"dataSourceID"`
	DatasourceUID  string `json:"dataSourceUID"`
	Enabled        bool   `json:"enabled"`
	TTLQueriesMs   int64  `json:"ttlQueriesMs"`
	TTLResourcesMs int64  `json:"ttlResourcesMs"`
	UseDefaultTLS  bool   `json:"useDefaultTTL"`
	DefaultTTLMs   int64  `json:"defaultTTLMs"`
	Created        string `json:"created"`
	Updated        string `json:"updated"`
}

type DatasourceCachePayload struct {
	DatasourceID   int64  `json:"dataSourceID"`
	DatasourceUID  string `json:"dataSourceUID"`
	Enabled        bool   `json:"enabled"`
	UseDefaultTLS  bool   `json:"useDefaultTTL"`
	TTLQueriesMs   int64  `json:"ttlQueriesMs"`
	TTLResourcesMs int64  `json:"ttlResourcesMs"`
}

// EnableDatasourceCache enables the datasource cache (this is a datasource setting)
func (c *Client) EnableDatasourceCache(id int64) error {
	path := fmt.Sprintf("/api/datasources/%d/cache/enable", id)
	if err := c.request("POST", path, nil, nil, nil); err != nil {
		return fmt.Errorf("error enabling cache at %s: %w", path, err)
	}
	return nil
}

// DisableDatasourceCache disables the datasource cache (this is a datasource setting)
func (c *Client) DisableDatasourceCache(id int64) error {
	path := fmt.Sprintf("/api/datasources/%d/cache/disable", id)
	if err := c.request("POST", path, nil, nil, nil); err != nil {
		return fmt.Errorf("error disabling cache at %s: %w", path, err)
	}
	return nil
}

// UpdateDatasourceCache updates the cache configurations
func (c *Client) UpdateDatasourceCache(id int64, payload *DatasourceCachePayload) error {
	path := fmt.Sprintf("/api/datasources/%d/cache", id)
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal err: %w", err)
	}

	if err = c.request("POST", path, nil, data, nil); err != nil {
		return fmt.Errorf("error updating cache at %s: %w", path, err)
	}

	return nil
}

// DatasourceCache fetches datasource cache configuration
func (c *Client) DatasourceCache(id int64) (*DatasourceCache, error) {
	path := fmt.Sprintf("/api/datasources/%d/cache", id)
	cache := &DatasourceCache{}
	err := c.request("GET", path, nil, nil, cache)
	if err != nil {
		return cache, fmt.Errorf("error getting cache at %s: %w", path, err)
	}
	return cache, nil
}
