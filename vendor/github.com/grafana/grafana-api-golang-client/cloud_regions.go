package gapi

import "fmt"

// CloudRegion represents a Grafana Cloud region.
// https://grafana.com/docs/grafana-cloud/reference/cloud-api/#list-regions
type CloudRegion struct {
	ID          int    `json:"id"`
	Status      string `json:"status"`
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
	Visibility  string `json:"visibility"`

	// Service URLs for the region
	StackStateServiceURL      string `json:"stackStateServiceUrl"`
	SyntheticMonitoringAPIURL string `json:"syntheticMonitoringApiUrl"`
	IntegrationsAPIURL        string `json:"integrationsApiUrl"`
	HostedExportersAPIURL     string `json:"hostedExportersApiUrl"`
	MachineLearningAPIURL     string `json:"machineLearningApiUrl"`
	IncidentsAPIURL           string `json:"incidentsApiUrl"`

	// Hosted Grafana
	HGClusterID   int    `json:"hgClusterId"`
	HGClusterSlug string `json:"hgClusterSlug"`
	HGClusterName string `json:"hgClusterName"`
	HGClusterURL  string `json:"hgClusterUrl"`

	// Hosted Metrics: Prometheus
	HMPromClusterID   int    `json:"hmPromClusterId"`
	HMPromClusterSlug string `json:"hmPromClusterSlug"`
	HMPromClusterName string `json:"hmPromClusterName"`
	HMPromClusterURL  string `json:"hmPromClusterUrl"`

	// Hosted Metrics: Graphite
	HMGraphiteClusterID   int    `json:"hmGraphiteClusterId"`
	HMGraphiteClusterSlug string `json:"hmGraphiteClusterSlug"`
	HMGraphiteClusterName string `json:"hmGraphiteClusterName"`
	HMGraphiteClusterURL  string `json:"hmGraphiteClusterUrl"`

	// Hosted Logs
	HLClusterID   int    `json:"hlClusterId"`
	HLClusterSlug string `json:"hlClusterSlug"`
	HLClusterName string `json:"hlClusterName"`
	HLClusterURL  string `json:"hlClusterUrl"`

	// Alertmanager
	AMClusterID   int    `json:"amClusterId"`
	AMClusterSlug string `json:"amClusterSlug"`
	AMClusterName string `json:"amClusterName"`
	AMClusterURL  string `json:"amClusterUrl"`

	// Hosted Traces
	HTClusterID   int    `json:"htClusterId"`
	HTClusterSlug string `json:"htClusterSlug"`
	HTClusterName string `json:"htClusterName"`
	HTClusterURL  string `json:"htClusterUrl"`
}

// CloudRegionsResponse represents the response from the Grafana Cloud regions API.
type CloudRegionsResponse struct {
	Items []CloudRegion `json:"items"`
}

// GetCloudRegions fetches and returns all Grafana Cloud regions.
func (c *Client) GetCloudRegions() (CloudRegionsResponse, error) {
	var regions CloudRegionsResponse
	err := c.request("GET", "/api/stack-regions", nil, nil, &regions)
	return regions, err
}

// GetCloudRegionBySlug fetches and returns the cloud region which matches the given slug.
// You can also provide a numeric region ID.
func (c *Client) GetCloudRegionBySlug(slug string) (CloudRegion, error) {
	var region CloudRegion
	err := c.request("GET", fmt.Sprintf("/api/stack-regions/%s", slug), nil, nil, &region)
	return region, err
}
