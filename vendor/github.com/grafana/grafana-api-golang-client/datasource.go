package gapi

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DataSource represents a Grafana data source.
type DataSource struct {
	ID   int64  `json:"id,omitempty"`
	UID  string `json:"uid,omitempty"`
	Name string `json:"name"`

	Type string `json:"type"`
	// This is only returned by the API. It depends on the Type.
	TypeLogoURL string `json:"typeLogoUrl,omitempty"`

	URL    string `json:"url"`
	Access string `json:"access"`

	// This is only returned by the API. It can only be set through the `editable` attribute of provisioned data sources.
	ReadOnly bool `json:"readOnly"`

	Database string `json:"database,omitempty"`
	User     string `json:"user,omitempty"`

	OrgID     int64 `json:"orgId,omitempty"`
	IsDefault bool  `json:"isDefault"`

	BasicAuth     bool   `json:"basicAuth"`
	BasicAuthUser string `json:"basicAuthUser,omitempty"`

	WithCredentials bool `json:"withCredentials,omitempty"`

	JSONData       map[string]interface{} `json:"jsonData,omitempty"`
	SecureJSONData map[string]interface{} `json:"secureJsonData,omitempty"`

	Version int `json:"version,omitempty"`
}

// NewDataSource creates a new Grafana data source.
func (c *Client) NewDataSource(s *DataSource) (int64, error) {
	data, err := json.Marshal(s)
	if err != nil {
		return 0, err
	}

	result := struct {
		ID int64 `json:"id"`
	}{}

	err = c.request("POST", "/api/datasources", nil, data, &result)
	if err != nil {
		return 0, err
	}

	return result.ID, err
}

// UpdateDataSource updates a Grafana data source.
func (c *Client) UpdateDataSource(s *DataSource) error {
	path := fmt.Sprintf("/api/datasources/%d", s.ID)
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}

	return c.request("PUT", path, nil, data, nil)
}

func (c *Client) UpdateDataSourceByUID(s *DataSource) error {
	path := fmt.Sprintf("/api/datasources/uid/%s", s.UID)
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}

	return c.request("PUT", path, nil, data, nil)
}

// DataSource fetches and returns the Grafana data source whose ID it's passed.
func (c *Client) DataSource(id int64) (*DataSource, error) {
	path := fmt.Sprintf("/api/datasources/%d", id)
	result := &DataSource{}
	err := c.request("GET", path, nil, nil, result)
	if err != nil {
		return nil, err
	}

	return result, err
}

// DataSourceByUID fetches and returns the Grafana data source whose UID is passed.
func (c *Client) DataSourceByUID(uid string) (*DataSource, error) {
	path := fmt.Sprintf("/api/datasources/uid/%s", uid)
	result := &DataSource{}
	err := c.request("GET", path, nil, nil, result)
	if err != nil {
		return nil, err
	}

	return result, err
}

// DataSourceByName fetches and returns the Grafana data source whose name is passed.
func (c *Client) DataSourceByName(name string) (*DataSource, error) {
	path := fmt.Sprintf("/api/datasources/name/%s", name)
	result := &DataSource{}
	err := c.request("GET", path, nil, nil, result)
	if err != nil {
		return nil, err
	}

	return result, err
}

// DataSourceIDByName returns the Grafana data source ID by name.
func (c *Client) DataSourceIDByName(name string) (int64, error) {
	path := fmt.Sprintf("/api/datasources/id/%s", name)

	result := struct {
		ID int64 `json:"id"`
	}{}

	err := c.request("GET", path, nil, nil, &result)
	if err != nil {
		return 0, err
	}

	return result.ID, nil
}

// DataSources returns all data sources as defined in Grafana.
func (c *Client) DataSources() ([]*DataSource, error) {
	result := make([]*DataSource, 0)
	err := c.request("GET", "/api/datasources", nil, nil, &result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// DeleteDataSource deletes the Grafana data source whose ID it's passed.
func (c *Client) DeleteDataSource(id int64) error {
	path := fmt.Sprintf("/api/datasources/%d", id)

	return c.request("DELETE", path, nil, nil, nil)
}

// DeleteDataSourceByName deletes the Grafana data source whose NAME it's passed.
func (c *Client) DeleteDataSourceByName(name string) error {
	path := fmt.Sprintf("/api/datasources/name/%s", name)

	return c.request("DELETE", path, nil, nil, nil)
}

func cloneMap(m map[string]interface{}) map[string]interface{} {
	clone := make(map[string]interface{})
	for k, v := range m {
		clone[k] = v
	}
	return clone
}

func JSONDataWithHeaders(jsonData, secureJSONData map[string]interface{}, headers map[string]string) (map[string]interface{}, map[string]interface{}) {
	// Clone the maps so we don't modify the original
	jsonData = cloneMap(jsonData)
	secureJSONData = cloneMap(secureJSONData)

	idx := 1
	for name, value := range headers {
		jsonData[fmt.Sprintf("httpHeaderName%d", idx)] = name
		secureJSONData[fmt.Sprintf("httpHeaderValue%d", idx)] = value
		idx++
	}

	return jsonData, secureJSONData
}

func ExtractHeadersFromJSONData(jsonData, secureJSONData map[string]interface{}) (map[string]interface{}, map[string]interface{}, map[string]string) {
	// Clone the maps so we don't modify the original
	jsonData = cloneMap(jsonData)
	secureJSONData = cloneMap(secureJSONData)
	headers := make(map[string]string)

	for dataName, dataValue := range jsonData {
		if strings.HasPrefix(dataName, "httpHeaderName") {
			// Remove the header name from JSON data
			delete(jsonData, dataName)

			// Remove the header value from secure JSON data
			secureDataName := strings.Replace(dataName, "httpHeaderName", "httpHeaderValue", 1)
			delete(secureJSONData, secureDataName)

			headerName := dataValue.(string)
			headers[headerName] = "true" // We can't retrieve the headers, so we just set a dummy value
		}
	}

	return jsonData, secureJSONData, headers
}
