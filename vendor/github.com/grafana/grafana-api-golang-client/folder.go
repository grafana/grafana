package gapi

import (
	"encoding/json"
	"fmt"
	"net/url"
)

// Folder represents a Grafana folder.
type Folder struct {
	ID    int64  `json:"id"`
	UID   string `json:"uid"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

type FolderPayload struct {
	Title     string `json:"title"`
	UID       string `json:"uid,omitempty"`
	Overwrite bool   `json:"overwrite,omitempty"`
}

// Folders fetches and returns Grafana folders.
func (c *Client) Folders() ([]Folder, error) {
	const limit = 1000
	var (
		page       = 0
		newFolders []Folder
		folders    []Folder
		query      = make(url.Values)
	)
	query.Set("limit", fmt.Sprint(limit))
	for {
		page++
		query.Set("page", fmt.Sprint(page))

		if err := c.request("GET", "/api/folders/", query, nil, &newFolders); err != nil {
			return nil, err
		}

		folders = append(folders, newFolders...)

		if len(newFolders) < limit {
			return folders, nil
		}
	}
}

// Folder fetches and returns the Grafana folder whose ID it's passed.
func (c *Client) Folder(id int64) (*Folder, error) {
	folder := &Folder{}
	err := c.request("GET", fmt.Sprintf("/api/folders/id/%d", id), nil, nil, folder)
	if err != nil {
		return folder, err
	}

	return folder, err
}

// Folder fetches and returns the Grafana folder whose UID it's passed.
func (c *Client) FolderByUID(uid string) (*Folder, error) {
	folder := &Folder{}
	err := c.request("GET", fmt.Sprintf("/api/folders/%s", uid), nil, nil, folder)
	if err != nil {
		return folder, err
	}

	return folder, err
}

// NewFolder creates a new Grafana folder.
func (c *Client) NewFolder(title string, uid ...string) (Folder, error) {
	if len(uid) > 1 {
		return Folder{}, fmt.Errorf("too many arguments. Expected 1 or 2")
	}

	folder := Folder{}
	payload := FolderPayload{
		Title: title,
	}
	if len(uid) == 1 {
		payload.UID = uid[0]
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return folder, err
	}

	err = c.request("POST", "/api/folders", nil, data, &folder)
	if err != nil {
		return folder, err
	}

	return folder, err
}

// UpdateFolder updates the folder whose UID it's passed.
func (c *Client) UpdateFolder(uid string, title string, newUID ...string) error {
	payload := FolderPayload{
		Title:     title,
		Overwrite: true,
	}
	if len(newUID) == 1 {
		payload.UID = newUID[0]
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return c.request("PUT", fmt.Sprintf("/api/folders/%s", uid), nil, data, nil)
}

func ForceDeleteFolderRules() url.Values {
	query := make(url.Values)
	query.Set("forceDeleteRules", "true")
	return query
}

// DeleteFolder deletes the folder whose ID it's passed.
func (c *Client) DeleteFolder(id string, optionalQueryParams ...url.Values) error {
	query := url.Values{}
	for _, param := range optionalQueryParams {
		for paramKey := range param {
			query.Set(paramKey, param.Get(paramKey))
		}
	}

	return c.request("DELETE", fmt.Sprintf("/api/folders/%s", id), query, nil, nil)
}
