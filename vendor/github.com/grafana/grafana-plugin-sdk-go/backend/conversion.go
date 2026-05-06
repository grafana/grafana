package backend

import (
	"context"
)

const (
	// EndpointConvertObjects friendly name for the convert objects endpoint/handler.
	EndpointConvertObjects Endpoint = "convertObjects"
)

// ConversionHandler is an EXPERIMENTAL service that allows converting objects between versions
// This is modeled after the kubernetes CRD conversion webhooks.
// Since grafana 11.1, this feature is under active development and will continue to evolve in 2024
// This may also be replaced with a more native kubernetes solution that does not work with existing tooling

type ConversionHandler interface {
	// ConvertObject is called to covert objects between different versions
	ConvertObjects(context.Context, *ConversionRequest) (*ConversionResponse, error)
}

type ConvertObjectsFunc func(context.Context, *ConversionRequest) (*ConversionResponse, error)

// ConvertObjects calls fn(ctx, req).
func (fn ConvertObjectsFunc) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	return fn(ctx, req)
}

type GroupVersion struct {
	Group   string `json:"group,omitempty"`
	Version string `json:"version,omitempty"`
}

// ConversionRequest supports converting an object from on version to another
type ConversionRequest struct {
	// NOTE: this may not include app or datasource instance settings depending on the request
	PluginContext PluginContext `json:"pluginContext,omitempty"`
	// UID is an identifier for the individual request/response. It allows distinguishing instances of requests which are
	// otherwise identical (parallel requests, etc).
	// The UID is meant to track the round trip (request/response) between the Kubernetes API server and the webhook, not the user request.
	// It is suitable for correlating log entries between the webhook and apiserver, for either auditing or debugging.
	UID string `json:"uid,omitempty"`
	// TargetVersion is the version the object should be converted to.
	TargetVersion GroupVersion `json:"target_version,omitempty"`
	// Objects is the list of objects to convert. This contains the full metadata envelope.
	Objects []RawObject `json:"objects,omitempty"`
}

type RawObject struct {
	// Raw is the underlying serialization of this object.
	Raw []byte `json:"-" `
	// ContentType is the media type of the object.
	ContentType string `json:"-"`
}

type ConversionResponse struct {
	// UID is an identifier for the individual request/response.
	// This should be copied over from the corresponding `request.uid`.
	UID string `json:"uid,omitempty"`
	// Result contains extra details into why an admission request was denied.
	Result *StatusResult `json:"result,omitempty"`
	// Objects is the list of converted version of `request.objects` if the `result` is successful, otherwise empty.
	Objects []RawObject `json:"objects,omitempty"`
}
