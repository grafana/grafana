package backend

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
)

// PluginConfig holds configuration for the queried plugin.
type PluginConfig struct {
	ID       int64
	OrgID    int64
	Name     string
	Type     string
	URL      string
	JSONData json.RawMessage
}

type DataQueryRequest struct {
	PluginConfig PluginConfig
	Headers      map[string]string
	Queries      []DataQuery
}

// DataQuery represents the query as sent from the frontend.
type DataQuery struct {
	RefID         string
	MaxDataPoints int64
	Interval      time.Duration
	TimeRange     TimeRange
	JSON          json.RawMessage
}

// DataQueryResponse holds the results for a given query.
type DataQueryResponse struct {
	Frames   []*dataframe.Frame
	Metadata map[string]string
}

// TimeRange represents a time range for a query.
type TimeRange struct {
	From time.Time
	To   time.Time
}

// DataQueryHandler handles data source queries.
type DataQueryHandler interface {
	DataQuery(ctx context.Context, req *DataQueryRequest) (*DataQueryResponse, error)
}

// PluginHandlers is the collection of handlers that corresponds to the
// grpc "service BackendPlugin".
type PluginHandlers interface {
	DataQueryHandler
}
