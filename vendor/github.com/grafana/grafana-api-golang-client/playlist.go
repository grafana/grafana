package gapi

import (
	"encoding/json"
	"fmt"
)

// PlaylistItem represents a Grafana playlist item.
type PlaylistItem struct {
	Type  string `json:"type"`
	Value string `json:"value"`
	Order int    `json:"order"`
	Title string `json:"title"`
}

// Playlist represents a Grafana playlist.
type Playlist struct {
	ID       int            `json:"id,omitempty"`  // Grafana < 9.0
	UID      string         `json:"uid,omitempty"` // Grafana >= 9.0
	Name     string         `json:"name"`
	Interval string         `json:"interval"`
	Items    []PlaylistItem `json:"items"`
}

// Grafana 9.0+ returns the ID and the UID but uses the UID in the API calls.
// Grafana <9 only returns the ID.
func (p *Playlist) QueryID() string {
	if p.UID != "" {
		return p.UID
	}
	return fmt.Sprintf("%d", p.ID)
}

// Playlist fetches and returns a Grafana playlist.
func (c *Client) Playlist(idOrUID string) (*Playlist, error) {
	path := fmt.Sprintf("/api/playlists/%s", idOrUID)
	playlist := &Playlist{}
	err := c.request("GET", path, nil, nil, playlist)
	if err != nil {
		return nil, err
	}

	return playlist, nil
}

// NewPlaylist creates a new Grafana playlist.
func (c *Client) NewPlaylist(playlist Playlist) (string, error) {
	data, err := json.Marshal(playlist)
	if err != nil {
		return "", err
	}

	var result Playlist

	err = c.request("POST", "/api/playlists", nil, data, &result)
	if err != nil {
		return "", err
	}

	return result.QueryID(), nil
}

// UpdatePlaylist updates a Grafana playlist.
func (c *Client) UpdatePlaylist(playlist Playlist) error {
	path := fmt.Sprintf("/api/playlists/%s", playlist.QueryID())
	data, err := json.Marshal(playlist)
	if err != nil {
		return err
	}

	return c.request("PUT", path, nil, data, nil)
}

// DeletePlaylist deletes the Grafana playlist whose ID it's passed.
func (c *Client) DeletePlaylist(idOrUID string) error {
	path := fmt.Sprintf("/api/playlists/%s", idOrUID)

	return c.request("DELETE", path, nil, nil, nil)
}
