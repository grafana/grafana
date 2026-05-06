package backend

import (
	"context"
	"net/http"
	"strconv"
)

const (
	// EndpointCheckHealth friendly name for the check health endpoint/handler.
	EndpointCheckHealth Endpoint = "checkHealth"

	// EndpointCollectMetrics friendly name for the collect metrics endpoint/handler.
	EndpointCollectMetrics Endpoint = "collectMetrics"
)

// CheckHealthHandler enables users to send health check
// requests to a backend plugin
type CheckHealthHandler interface {
	CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error)
}

// CheckHealthHandlerFunc is an adapter to allow the use of
// ordinary functions as [CheckHealthHandler]. If f is a function
// with the appropriate signature, CheckHealthHandlerFunc(f) is a
// [CheckHealthHandler] that calls f.
type CheckHealthHandlerFunc func(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error)

// CheckHealth calls fn(ctx, req).
func (fn CheckHealthHandlerFunc) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	return fn(ctx, req)
}

// HealthStatus is the status of the plugin.
type HealthStatus int

const (
	// HealthStatusUnknown means the status of the plugin is unknown.
	HealthStatusUnknown HealthStatus = iota

	// HealthStatusOk means the status of the plugin is good.
	HealthStatusOk

	// HealthStatusError means the plugin is in an error state.
	HealthStatusError
)

var healthStatusNames = map[int]string{
	0: "UNKNOWN",
	1: "OK",
	2: "ERROR",
}

// String textual representation of the status.
func (hs HealthStatus) String() string {
	s, exists := healthStatusNames[int(hs)]
	if exists {
		return s
	}
	return strconv.Itoa(int(hs))
}

// CheckHealthRequest contains the healthcheck request
type CheckHealthRequest struct {
	// PluginContext the contextual information for the request.
	PluginContext PluginContext

	// Headers the environment/metadata information for the request.
	// To access forwarded HTTP headers please use GetHTTPHeaders or GetHTTPHeader.
	Headers map[string]string
}

// SetHTTPHeader sets the header entries associated with key to the
// single element value. It replaces any existing values
// associated with key. The key is case-insensitive; it is
// canonicalized by textproto.CanonicalMIMEHeaderKey.
func (req *CheckHealthRequest) SetHTTPHeader(key, value string) {
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}

	setHTTPHeaderInStringMap(req.Headers, key, value)
}

// DeleteHTTPHeader deletes the values associated with key.
// The key is case-insensitive; it is canonicalized by
// CanonicalHeaderKey.
func (req *CheckHealthRequest) DeleteHTTPHeader(key string) {
	deleteHTTPHeaderInStringMap(req.Headers, key)
}

// GetHTTPHeader gets the first value associated with the given key. If
// there are no values associated with the key, Get returns "".
// It is case-insensitive; textproto.CanonicalMIMEHeaderKey is
// used to canonicalize the provided key. Get assumes that all
// keys are stored in canonical form.
func (req *CheckHealthRequest) GetHTTPHeader(key string) string {
	return req.GetHTTPHeaders().Get(key)
}

// GetHTTPHeaders returns HTTP headers.
func (req *CheckHealthRequest) GetHTTPHeaders() http.Header {
	return getHTTPHeadersFromStringMap(req.Headers)
}

// CheckHealthResult contains the healthcheck response
type CheckHealthResult struct {
	// Status the HealthStatus of the healthcheck.
	Status HealthStatus

	// Message the message of the healthcheck, if any.
	Message string

	// JSONDetails the details of the healthcheck, if any, encoded as JSON bytes.
	JSONDetails []byte
}

// CollectMetricsHandler handles metric collection.
type CollectMetricsHandler interface {
	CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error)
}

// CollectMetricsHandlerFunc is an adapter to allow the use of
// ordinary functions as backend.CollectMetricsHandler. If f is a function
// with the appropriate signature, CollectMetricsHandlerFunc(f) is a
// Handler that calls f.
type CollectMetricsHandlerFunc func(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error)

// CollectMetrics calls fn(ctx, req).
func (fn CollectMetricsHandlerFunc) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	return fn(ctx, req)
}

// CollectMetricsRequest contains the metrics request
type CollectMetricsRequest struct {
	// PluginContext the contextual information for the request.
	PluginContext PluginContext
}

// CollectMetricsResult collect metrics result.
type CollectMetricsResult struct {
	// PrometheusMetrics the Prometheus metrics encoded as bytes.
	PrometheusMetrics []byte
}

var _ ForwardHTTPHeaders = (*CheckHealthRequest)(nil)
