// Slo types lifted from github.com/grafana/slo/pkg/generated/models/slo/slo_type_gen.go
package gapi

import (
	"encoding/json"
	"fmt"
)

var sloPath = "/api/plugins/grafana-slo-app/resources/v1/slo"

type Slos struct {
	Slos []Slo `json:"slos"`
}

// Defines values for QueryType.
const (
	QueryTypeFreeform  QueryType = "freeform"
	QueryTypeHistogram QueryType = "histogram"
	QueryTypeRatio     QueryType = "ratio"
	QueryTypeThreshold QueryType = "threshold"
)

// Defines values for ThresholdOperator.
const (
	ThresholdOperatorEmpty      ThresholdOperator = "<"
	ThresholdOperatorEqualEqual ThresholdOperator = "=="
	ThresholdOperatorN1         ThresholdOperator = "<="
	ThresholdOperatorN2         ThresholdOperator = ">="
	ThresholdOperatorN3         ThresholdOperator = ">"
)

// Alerting defines model for Alerting.
type Alerting struct {
	Annotations []Label           `json:"annotations,omitempty"`
	FastBurn    *AlertingMetadata `json:"fastBurn,omitempty"`
	Labels      []Label           `json:"labels,omitempty"`
	SlowBurn    *AlertingMetadata `json:"slowBurn,omitempty"`
}

// AlertingMetadata defines model for AlertingMetadata.
type AlertingMetadata struct {
	Annotations []Label `json:"annotations,omitempty"`
	Labels      []Label `json:"labels,omitempty"`
}

// DashboardRef defines model for DashboardRef.
type DashboardRef struct {
	UID string `json:"UID"`
}

// DestinationDatasource defines model for DestinationDatasource.
type DestinationDatasource struct {
	Type string `json:"type,omitempty"`
	UID  string `json:"uid,omitempty"`
}

// FreeformQuery defines model for FreeformQuery.
type FreeformQuery struct {
	Query string `json:"query"`
}

// HistogramQuery defines model for HistogramQuery.
type HistogramQuery struct {
	GroupByLabels []string  `json:"groupByLabels,omitempty"`
	Metric        MetricDef `json:"metric"`
	Percentile    float64   `json:"percentile"`
	Threshold     Threshold `json:"threshold"`
}

// Label defines model for Label.
type Label struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// MetricDef defines model for MetricDef.
type MetricDef struct {
	PrometheusMetric string `json:"prometheusMetric"`
	Type             string `json:"type,omitempty"`
}

// Objective defines model for Objective.
type Objective struct {
	Value  float64 `json:"value"`
	Window string  `json:"window"`
}

// Query defines model for Query.
type Query struct {
	Freeform  *FreeformQuery  `json:"freeform,omitempty"`
	Histogram *HistogramQuery `json:"histogram,omitempty"`
	Ratio     *RatioQuery     `json:"ratio,omitempty"`
	Threshold *ThresholdQuery `json:"threshold,omitempty"`
	Type      QueryType       `json:"type"`
}

// QueryType defines model for Query.Type.
type QueryType string

// RatioQuery defines model for RatioQuery.
type RatioQuery struct {
	GroupByLabels []string  `json:"groupByLabels,omitempty"`
	SuccessMetric MetricDef `json:"successMetric"`
	TotalMetric   MetricDef `json:"totalMetric"`
}

// ReadOnly defines model for ReadOnly.
type ReadOnly struct {
	DrillDownDashboardRef *DashboardRef `json:"drillDownDashboardRef,omitempty"`
	Provenance            string        `json:"provenance,omitempty"`
	Status                *Status       `json:"status,omitempty"`
}

// Slo defines model for Slo.
type Slo struct {
	Alerting              *Alerting              `json:"alerting,omitempty"`
	Description           string                 `json:"description"`
	DestinationDatasource *DestinationDatasource `json:"destinationDatasource,omitempty"`
	Labels                []Label                `json:"labels,omitempty"`
	Name                  string                 `json:"name"`
	Objectives            []Objective            `json:"objectives"`
	Query                 Query                  `json:"query"`
	ReadOnly              *ReadOnly              `json:"readOnly,omitempty"`
	UUID                  string                 `json:"uuid"`
}

// Status defines model for Status.
type Status struct {
	Message string `json:"message,omitempty"`
	Type    string `json:"type"`
}

// Threshold defines model for Threshold.
type Threshold struct {
	Operator ThresholdOperator `json:"operator"`
	Value    float64           `json:"value"`
}

// ThresholdOperator defines model for Threshold.Operator.
type ThresholdOperator string

// ThresholdQuery defines model for ThresholdQuery.
type ThresholdQuery struct {
	GroupByLabels []string  `json:"groupByLabels,omitempty"`
	Metric        MetricDef `json:"metric"`
	Threshold     Threshold `json:"threshold"`
}

type CreateSLOResponse struct {
	Message string `json:"message,omitempty"`
	UUID    string `json:"uuid,omitempty"`
}

// ListSlos retrieves a list of all Slos
func (c *Client) ListSlos() (Slos, error) {
	var slos Slos

	if err := c.request("GET", sloPath, nil, nil, &slos); err != nil {
		return Slos{}, err
	}

	return slos, nil
}

// GetSLO returns a single Slo based on its uuid
func (c *Client) GetSlo(uuid string) (Slo, error) {
	var slo Slo
	path := fmt.Sprintf("%s/%s", sloPath, uuid)

	if err := c.request("GET", path, nil, nil, &slo); err != nil {
		return Slo{}, err
	}

	return slo, nil
}

// CreateSLO creates a single Slo
func (c *Client) CreateSlo(slo Slo) (CreateSLOResponse, error) {
	response := CreateSLOResponse{}

	data, err := json.Marshal(slo)
	if err != nil {
		return response, err
	}

	if err := c.request("POST", sloPath, nil, data, &response); err != nil {
		return CreateSLOResponse{}, err
	}

	return response, err
}

// DeleteSLO deletes the Slo with the passed in UUID
func (c *Client) DeleteSlo(uuid string) error {
	path := fmt.Sprintf("%s/%s", sloPath, uuid)
	return c.request("DELETE", path, nil, nil, nil)
}

// UpdateSLO updates the Slo with the passed in UUID and Slo
func (c *Client) UpdateSlo(uuid string, slo Slo) error {
	path := fmt.Sprintf("%s/%s", sloPath, uuid)

	data, err := json.Marshal(slo)
	if err != nil {
		return err
	}

	return c.request("PUT", path, nil, data, nil)
}
