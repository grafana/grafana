package gapi

import (
	"encoding/json"
	"fmt"
	"net/url"
)

// Annotation represents a Grafana API Annotation
type Annotation struct {
	ID           int64    `json:"id,omitempty"`
	AlertID      int64    `json:"alertId,omitempty"`
	DashboardID  int64    `json:"dashboardId,omitempty"`
	DashboardUID string   `json:"dashboardUID,omitempty"`
	PanelID      int64    `json:"panelId"`
	UserID       int64    `json:"userId,omitempty"`
	UserName     string   `json:"userName,omitempty"`
	NewState     string   `json:"newState,omitempty"`
	PrevState    string   `json:"prevState,omitempty"`
	Time         int64    `json:"time"`
	TimeEnd      int64    `json:"timeEnd,omitempty"`
	Text         string   `json:"text"`
	Metric       string   `json:"metric,omitempty"`
	RegionID     int64    `json:"regionId,omitempty"`
	Type         string   `json:"type,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	IsRegion     bool     `json:"isRegion,omitempty"`
}

// GraphiteAnnotation represents a Grafana API annotation in Graphite format
type GraphiteAnnotation struct {
	What string   `json:"what"`
	When int64    `json:"when"`
	Data string   `json:"data"`
	Tags []string `json:"tags,omitempty"`
}

// Annotations fetches the annotations queried with the params it's passed
func (c *Client) Annotations(params url.Values) ([]Annotation, error) {
	result := []Annotation{}
	err := c.request("GET", "/api/annotations", params, nil, &result)
	if err != nil {
		return nil, err
	}

	return result, err
}

// NewAnnotation creates a new annotation with the Annotation it is passed
func (c *Client) NewAnnotation(a *Annotation) (int64, error) {
	data, err := json.Marshal(a)
	if err != nil {
		return 0, err
	}

	result := struct {
		ID int64 `json:"id"`
	}{}

	err = c.request("POST", "/api/annotations", nil, data, &result)
	if err != nil {
		return 0, err
	}

	return result.ID, err
}

// NewGraphiteAnnotation creates a new annotation with the GraphiteAnnotation it is passed
func (c *Client) NewGraphiteAnnotation(gfa *GraphiteAnnotation) (int64, error) {
	data, err := json.Marshal(gfa)
	if err != nil {
		return 0, err
	}

	result := struct {
		ID int64 `json:"id"`
	}{}

	err = c.request("POST", "/api/annotations/graphite", nil, data, &result)
	if err != nil {
		return 0, err
	}

	return result.ID, err
}

// UpdateAnnotation updates all properties an existing annotation with the Annotation it is passed.
func (c *Client) UpdateAnnotation(id int64, a *Annotation) (string, error) {
	path := fmt.Sprintf("/api/annotations/%d", id)
	data, err := json.Marshal(a)
	if err != nil {
		return "", err
	}

	result := struct {
		Message string `json:"message"`
	}{}

	err = c.request("PUT", path, nil, data, &result)
	if err != nil {
		return "", err
	}

	return result.Message, err
}

// PatchAnnotation updates one or more properties of an existing annotation that matches the specified ID.
func (c *Client) PatchAnnotation(id int64, a *Annotation) (string, error) {
	path := fmt.Sprintf("/api/annotations/%d", id)
	data, err := json.Marshal(a)
	if err != nil {
		return "", err
	}

	result := struct {
		Message string `json:"message"`
	}{}

	err = c.request("PATCH", path, nil, data, &result)
	if err != nil {
		return "", err
	}

	return result.Message, err
}

// DeleteAnnotation deletes the annotation of the ID it is passed
func (c *Client) DeleteAnnotation(id int64) (string, error) {
	path := fmt.Sprintf("/api/annotations/%d", id)
	result := struct {
		Message string `json:"message"`
	}{}

	err := c.request("DELETE", path, nil, nil, &result)
	if err != nil {
		return "", err
	}

	return result.Message, err
}

// DeleteAnnotationByRegionID deletes the annotation corresponding to the region ID it is passed
func (c *Client) DeleteAnnotationByRegionID(id int64) (string, error) {
	path := fmt.Sprintf("/api/annotations/region/%d", id)
	result := struct {
		Message string `json:"message"`
	}{}

	err := c.request("DELETE", path, nil, nil, &result)
	if err != nil {
		return "", err
	}

	return result.Message, err
}
