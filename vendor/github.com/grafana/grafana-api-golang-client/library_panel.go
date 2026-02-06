package gapi

import (
	"encoding/json"
	"fmt"
	"time"
)

// LibraryPanelMetaUser represents the Grafana library panel createdBy and updatedBy fields
type LibraryPanelMetaUser struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	AvatarURL string `json:"folderId"`
}

// LibraryPanelMeta represents Grafana library panel metadata.
type LibraryPanelMeta struct {
	FolderName          string               `json:"folderName,,omitempty"`
	FolderUID           string               `json:"folderUid,omitempty"`
	ConnectedDashboards int64                `json:"connectedDashboards,omitempty"`
	Created             time.Time            `json:"created,omitempty"`
	Updated             time.Time            `json:"updated,omitempty"`
	CreatedBy           LibraryPanelMetaUser `json:"createdBy,omitempty"`
	UpdatedBy           LibraryPanelMetaUser `json:"updatedBy,omitempty"`
}

// LibraryPanel represents a Grafana library panel.
type LibraryPanel struct {
	Folder      int64                  `json:"folderId,omitempty"`
	Name        string                 `json:"name"`
	Model       map[string]interface{} `json:"model"`
	Type        string                 `json:"type,omitempty"`
	Description string                 `json:"description,omitempty"`
	ID          int64                  `json:"id,omitempty"`
	Kind        int64                  `json:"kind,omitempty"`
	OrgID       int64                  `json:"orgId,omitempty"`
	UID         string                 `json:"uid,omitempty"`
	Version     int64                  `json:"version,omitempty"`
	Meta        LibraryPanelMeta       `json:"meta,omitempty"`
}

// LibraryPanelCreateResponse represents the Grafana API response to creating or saving a library panel.
type LibraryPanelCreateResponse struct {
	Result LibraryPanel `json:"result"`
}

// LibraryPanelGetAllResponse represents the Grafana API response to getting all library panels.
type LibraryPanelGetAllResponse struct {
	TotalCount int64          `json:"totalCount"`
	Page       int64          `json:"page"`
	PerPage    int64          `json:"perPage"`
	Elements   []LibraryPanel `json:"elements"`
}

// LibraryPanelDeleteResponse represents the Grafana API response to deleting a library panel.
type LibraryPanelDeleteResponse struct {
	Message string `json:"message"`
	ID      int64  `json:"id,omitempty"`
}

// LibraryPanelConnection represents a Grafana connection between a library panel and a dashboard.
type LibraryPanelConnection struct {
	ID          int64                `json:"id"`
	Kind        int64                `json:"kind"`
	PanelID     int64                `json:"elementId"`
	DashboardID int64                `json:"connectionId"`
	Created     time.Time            `json:"created"`
	CreatedBy   LibraryPanelMetaUser `json:"createdBy"`
}

// NewLibraryPanel creates a new Grafana library panel.
func (c *Client) NewLibraryPanel(panel LibraryPanel) (*LibraryPanel, error) {
	panel.Kind = int64(1)
	data, err := json.Marshal(panel)
	if err != nil {
		return nil, err
	}

	resp := &LibraryPanelCreateResponse{}
	err = c.request("POST", "/api/library-elements", nil, data, &resp)
	if err != nil {
		return nil, err
	}

	return &resp.Result, err
}

// Dashboards fetches and returns all dashboards.
func (c *Client) LibraryPanels() ([]LibraryPanel, error) {
	resp := &struct {
		Result LibraryPanelGetAllResponse `json:"result"`
	}{}
	err := c.request("GET", "/api/library-elements", nil, nil, &resp)
	if err != nil {
		return nil, err
	}

	return resp.Result.Elements, err
}

// LibraryPanelByUID gets a library panel by UID.
func (c *Client) LibraryPanelByUID(uid string) (*LibraryPanel, error) {
	resp := &LibraryPanelCreateResponse{}
	path := fmt.Sprintf("/api/library-elements/%s", uid)

	err := c.request("GET", path, nil, nil, &resp)
	if err != nil {
		return nil, err
	}

	return &resp.Result, nil
}

// LibraryPanelByName gets a library panel by name.
func (c *Client) LibraryPanelByName(name string) (*LibraryPanel, error) {
	var resp struct {
		Result []LibraryPanel `json:"result"`
	}
	path := fmt.Sprintf("/api/library-elements/name/%s", name)

	err := c.request("GET", path, nil, nil, &resp)
	if err != nil {
		return nil, err
	}

	if len(resp.Result) != 1 {
		return nil, fmt.Errorf("expected 1 panel from GET library panel by name, got: %v", resp.Result)
	}

	return &resp.Result[0], err
}

// PatchLibraryPanel updates one or more properties of an existing panel that matches the specified UID.
func (c *Client) PatchLibraryPanel(uid string, panel LibraryPanel) (*LibraryPanel, error) {
	path := fmt.Sprintf("/api/library-elements/%s", uid)
	panel.Kind = int64(1)

	// if Version not specified, get current version from API
	if panel.Version == int64(0) {
		remotePanel, err := c.LibraryPanelByUID(panel.UID)
		if err != nil {
			return nil, err
		}
		panel.Version = remotePanel.Version
	}

	data, err := json.Marshal(panel)
	if err != nil {
		return nil, err
	}

	resp := &LibraryPanelCreateResponse{}
	err = c.request("PATCH", path, nil, data, &resp)
	if err != nil {
		return nil, err
	}

	return &resp.Result, err
}

// DeleteLibraryPanel deletes a panel by UID.
func (c *Client) DeleteLibraryPanel(uid string) (*LibraryPanelDeleteResponse, error) {
	path := fmt.Sprintf("/api/library-elements/%s", uid)

	resp := &LibraryPanelDeleteResponse{}
	err := c.request("DELETE", path, nil, nil, &resp)
	if err != nil {
		return nil, err
	}

	return resp, err
}

// LibraryPanelConnections gets library panel connections by UID.
func (c *Client) LibraryPanelConnections(uid string) (*[]LibraryPanelConnection, error) {
	path := fmt.Sprintf("/api/library-elements/%s/connections", uid)

	resp := struct {
		Result []LibraryPanelConnection `json:"result"`
	}{}

	err := c.request("GET", path, nil, nil, &resp)
	if err != nil {
		return nil, err
	}

	return &resp.Result, err
}

// LibraryPanelConnectedDashboards gets Dashboards using this Library Panel.
func (c *Client) LibraryPanelConnectedDashboards(uid string) ([]FolderDashboardSearchResponse, error) {
	connections, err := c.LibraryPanelConnections(uid)
	if err != nil {
		return nil, err
	}

	var dashboardIds []int64
	for _, connection := range *connections {
		dashboardIds = append(dashboardIds, connection.DashboardID)
	}

	return c.DashboardsByIDs(dashboardIds)
}
