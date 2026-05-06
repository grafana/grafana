package gapi

import (
	"encoding/json"
)

// Snapshot represents a Grafana snapshot.
type Snapshot struct {
	Model   map[string]interface{} `json:"dashboard"`
	Expires int64                  `json:"expires"`
}

// SnapshotResponse represents the Grafana API response to creating a dashboard.
type SnapshotCreateResponse struct {
	DeleteKey string `json:"deleteKey"`
	DeleteURL string `json:"deleteUrl"`
	Key       string `json:"key"`
	URL       string `json:"url"`
	ID        int64  `json:"id"`
}

// NewSnapshot creates a new Grafana snapshot.
func (c *Client) NewSnapshot(snapshot Snapshot) (*SnapshotCreateResponse, error) {
	data, err := json.Marshal(snapshot)
	if err != nil {
		return nil, err
	}

	result := &SnapshotCreateResponse{}
	err = c.request("POST", "/api/snapshots", nil, data, &result)
	if err != nil {
		return nil, err
	}

	return result, err
}
