package backend

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// QueryDataHandler handles data queries.
type QueryDataHandler interface {
	// QueryData handles multiple queries and returns multiple responses.
	// req contains the queries []DataQuery (where each query contains RefID as a unique identifer).
	// The QueryDataResponse contains a map of RefID to the response for each query, and each response
	// contains Frames ([]*Frame).
	QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error)
}

// QueryDataRequest contains a single request which contains multiple queries.
// It is the input type for a QueryData call.
type QueryDataRequest struct {
	PluginContext PluginContext
	Headers       map[string]string
	Queries       []DataQuery
}

// DataQuery represents a single query as sent from the frontend.
// A slice of DataQuery makes up the Queries property of a QueryDataRequest.
type DataQuery struct {
	// RefID is the unique identifer of the query, set by the frontend call.
	RefID string

	// MaxDataPoints is the maximum number of datapoints that should be returned from a time series query.
	MaxDataPoints int64

	// Interval is the suggested duration between time points in a time series query.
	Interval time.Duration

	// TimeRange is the Start and End of the query as sent by the frontend.
	TimeRange TimeRange

	// JSON is the raw JSON query and includes the above properties as well as custom properties.
	JSON json.RawMessage
}

// QueryDataResponse contains the results from a QueryDataRequest.
// It is the return type of a QueryData call.
type QueryDataResponse struct {
	// Responses is a map of RefIDs (Unique Query ID) to *DataResponse.
	Responses Responses
}

// NewQueryDataResponse returns a QueryDataResponse with the Responses property initialized.
func NewQueryDataResponse() *QueryDataResponse {
	return &QueryDataResponse{
		Responses: make(Responses),
	}
}

// Responses is a map of RefIDs (Unique Query ID) to DataResponses.
type Responses map[string]DataResponse

// DataResponse contains the results from a DataQuery.
// A map of RefIDs (unique query identifers) to this type makes up the Responses property of a QueryDataResponse.
// The Error property is used to allow for partial success responses from the containing QueryDataResponse.
type DataResponse struct {
	// The data returned from the Query. Each Frame repeats the RefID.
	Frames data.Frames

	// Error is a property to be set if the the corresponding DataQuery has an error.
	Error error
}

// TimeRange represents a time range for a query and is a property of DataQuery.
type TimeRange struct {
	// From is the start time of the query.
	From time.Time

	// To is the end time of the query.
	To time.Time
}

// Duration returns a time.Duration representing the amount of time between From and To.
func (tr TimeRange) Duration() time.Duration {
	return tr.To.Sub(tr.From)
}
