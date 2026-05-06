package backend

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

// EndpointQueryData friendly name for the query data endpoint/handler.
const EndpointQueryData Endpoint = "queryData"

// QueryDataHandler handles data queries.
type QueryDataHandler interface {
	// QueryData handles multiple queries and returns multiple responses.
	// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
	// The QueryDataResponse contains a map of RefID to the response for each query, and each response
	// contains Frames ([]*Frame).
	//
	// The Frames' RefID property, when it is an empty string, will be automatically set to
	// the RefID in QueryDataResponse.Responses map. This is done before the QueryDataResponse is
	// sent to Grafana. Therefore one does not need to be set that property on frames when using this method.
	QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error)
}

// QueryDataHandlerFunc is an adapter to allow the use of
// ordinary functions as [QueryDataHandler]. If f is a function
// with the appropriate signature, QueryDataHandlerFunc(f) is a
// [QueryDataHandler] that calls f.
type QueryDataHandlerFunc func(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error)

// QueryData calls fn(ctx, req).
func (fn QueryDataHandlerFunc) QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error) {
	return fn(ctx, req)
}

// QueryDataRequest contains a single request which contains multiple queries.
// It is the input type for a QueryData call.
type QueryDataRequest struct {
	// PluginContext the contextual information for the request.
	PluginContext PluginContext

	// Headers the environment/metadata information for the request.
	// To access forwarded HTTP headers please use GetHTTPHeaders or GetHTTPHeader.
	Headers map[string]string

	// Queries the data queries for the request.
	Queries []DataQuery
}

// SetHTTPHeader sets the header entries associated with key to the
// single element value. It replaces any existing values
// associated with key. The key is case-insensitive; it is
// canonicalized by textproto.CanonicalMIMEHeaderKey.
func (req *QueryDataRequest) SetHTTPHeader(key, value string) {
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}

	setHTTPHeaderInStringMap(req.Headers, key, value)
}

// DeleteHTTPHeader deletes the values associated with key.
// The key is case-insensitive; it is canonicalized by
// CanonicalHeaderKey.
func (req *QueryDataRequest) DeleteHTTPHeader(key string) {
	deleteHTTPHeaderInStringMap(req.Headers, key)
}

// GetHTTPHeader gets the first value associated with the given key. If
// there are no values associated with the key, Get returns "".
// It is case-insensitive; textproto.CanonicalMIMEHeaderKey is
// used to canonicalize the provided key. Get assumes that all
// keys are stored in canonical form.
func (req *QueryDataRequest) GetHTTPHeader(key string) string {
	return req.GetHTTPHeaders().Get(key)
}

// GetHTTPHeaders returns HTTP headers.
func (req *QueryDataRequest) GetHTTPHeaders() http.Header {
	return getHTTPHeadersFromStringMap(req.Headers)
}

// DataQuery represents a single query as sent from the frontend.
// A slice of DataQuery makes up the Queries property of a QueryDataRequest.
type DataQuery struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string

	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string

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
	Responses Responses `json:"results"`
}

// MarshalJSON writes the results as json
func (r QueryDataResponse) MarshalJSON() ([]byte, error) {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	writeQueryDataResponseJSON(&r, stream)
	return append([]byte(nil), stream.Buffer()...), stream.Error
}

// UnmarshalJSON will read JSON into a QueryDataResponse
func (r *QueryDataResponse) UnmarshalJSON(b []byte) error {
	iter := jsoniter.ParseBytes(jsoniter.ConfigDefault, b)
	readQueryDataResultsJSON(r, iter)
	return iter.Error
}

func (r *QueryDataResponse) DeepCopy() *QueryDataResponse {
	if r == nil {
		return nil
	}
	out := new(QueryDataResponse)
	r.DeepCopyInto(out)
	return out
}

func (r *QueryDataResponse) DeepCopyInto(out *QueryDataResponse) {
	if r.Responses == nil {
		out.Responses = nil
		return
	}
	if out.Responses == nil {
		out.Responses = make(Responses, len(r.Responses))
	} else {
		clear(out.Responses)
	}
	for k, v := range r.Responses {
		out.Responses[k] = *v.DeepCopy()
	}
}

// NewQueryDataResponse returns a QueryDataResponse with the Responses property initialized.
func NewQueryDataResponse() *QueryDataResponse {
	return &QueryDataResponse{
		Responses: make(Responses),
	}
}

// Responses is a map of RefIDs (Unique Query ID) to DataResponses.
// The QueryData method the QueryDataHandler method will set the RefId
// property on the DataResponses' frames based on these RefIDs.
//
//swagger:model
type Responses map[string]DataResponse

// DataResponse contains the results from a DataQuery.
// A map of RefIDs (unique query identifiers) to this type makes up the Responses property of a QueryDataResponse.
// The Error property is used to allow for partial success responses from the containing QueryDataResponse.
//
//swagger:model
type DataResponse struct {
	// The data returned from the Query. Each Frame repeats the RefID.
	Frames data.Frames

	// Error is a property to be set if the corresponding DataQuery has an error.
	Error error

	// Status codes map to HTTP status values
	Status Status

	// ErrorSource is the the source of the error
	ErrorSource ErrorSource
}

// ErrDataResponse returns an error DataResponse given status and message.
func ErrDataResponse(status Status, message string) DataResponse {
	return DataResponse{
		Error:  errors.New(message),
		Status: status,
	}
}

// ErrDataResponseWithSource returns an error DataResponse given status, source of the error and message.
func ErrDataResponseWithSource(status Status, src ErrorSource, message string) DataResponse {
	return DataResponse{
		Error:       errors.New(message),
		ErrorSource: src,
		Status:      status,
	}
}

// MarshalJSON writes the results as json
func (r DataResponse) MarshalJSON() ([]byte, error) {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	writeDataResponseJSON(&r, stream)
	return append([]byte(nil), stream.Buffer()...), stream.Error
}

func (r *DataResponse) DeepCopy() *DataResponse {
	if r == nil {
		return nil
	}
	out := &DataResponse{}
	body, err := r.MarshalJSON()
	if err == nil {
		iter := jsoniter.ParseBytes(jsoniter.ConfigDefault, body)
		readDataResponseJSON(out, iter)
	}
	return out
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

var _ ForwardHTTPHeaders = (*QueryDataRequest)(nil)
