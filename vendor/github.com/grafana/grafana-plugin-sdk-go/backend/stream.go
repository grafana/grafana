package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

const (
	// EndpointSubscribeStream friendly name for the subscribe stream endpoint/handler.
	EndpointSubscribeStream Endpoint = "subscribeStream"

	// EndpointPublishStream friendly name for the publish stream endpoint/handler.
	EndpointPublishStream Endpoint = "publishStream"

	// EndpointRunStream friendly name for the run stream endpoint/handler.
	EndpointRunStream Endpoint = "runStream"
)

// SubscribeStreamHandler handles stream subscription.
type SubscribeStreamHandler interface {
	// SubscribeStream called when a user tries to subscribe to a plugin/datasource
	// managed channel path – thus plugin can check subscribe permissions and communicate
	// options with Grafana Core. As soon as first subscriber joins channel RunStream
	// will be called.
	SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error)
}

// SubscribeStreamHandlerFunc is an adapter to allow the use of
// ordinary functions as backend.SubscribeStreamHandler. If f is a function
// with the appropriate signature, SubscribeStreamHandlerFunc(f) is a
// Handler that calls f.
type SubscribeStreamHandlerFunc func(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error)

// SubscribeStream calls fn(ctx, req, sender).
func (fn SubscribeStreamHandlerFunc) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	return fn(ctx, req)
}

// PublishStreamHandler handles stream publication.
type PublishStreamHandler interface {
	// PublishStream called when a user tries to publish to a plugin/datasource
	// managed channel path. Here plugin can check publish permissions and
	// modify publication data if required.
	PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error)
}

// PublishStreamHandlerFunc is an adapter to allow the use of
// ordinary functions as backend.PublishStreamHandler. If f is a function
// with the appropriate signature, SubscribeStreamHandlerFunc(f) is a
// Handler that calls f.
type PublishStreamHandlerFunc func(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error)

// SubscribeStream calls fn(ctx, req, sender).
func (fn PublishStreamHandlerFunc) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	return fn(ctx, req)
}

// RunStreamHandler handles running of streams.
type RunStreamHandler interface {
	// RunStream will be initiated by Grafana to consume a stream. RunStream will be
	// called once for the first client successfully subscribed to a channel path.
	// When Grafana detects that there are no longer any subscribers inside a channel,
	// the call will be terminated until next active subscriber appears. Call termination
	// can happen with a delay.
	RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error
}

// RunStreamHandlerFunc is an adapter to allow the use of
// ordinary functions as backend.RunStreamHandler. If f is a function
// with the appropriate signature, RunStreamHandlerFunc(f) is a
// Handler that calls f.
type RunStreamHandlerFunc func(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error

// RunStream calls fn(ctx, req, sender).
func (fn RunStreamHandlerFunc) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	return fn(ctx, req, sender)
}

// StreamHandler handles streams.
type StreamHandler interface {
	SubscribeStreamHandler
	PublishStreamHandler
	RunStreamHandler
}

// SubscribeStreamRequest represents a request for a subscribe stream call.
type SubscribeStreamRequest struct {
	PluginContext PluginContext
	Path          string
	Data          json.RawMessage

	// Headers the environment/metadata information for the request.
	// To access forwarded HTTP headers please use GetHTTPHeaders or GetHTTPHeader.
	Headers map[string]string
}

// SetHTTPHeader sets the header entries associated with key to the
// single element value. It replaces any existing values
// associated with key. The key is case-insensitive; it is
// canonicalized by textproto.CanonicalMIMEHeaderKey.
func (req *SubscribeStreamRequest) SetHTTPHeader(key, value string) {
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}

	setHTTPHeaderInStringMap(req.Headers, key, value)
}

// DeleteHTTPHeader deletes the values associated with key.
// The key is case-insensitive; it is canonicalized by
// CanonicalHeaderKey.
func (req *SubscribeStreamRequest) DeleteHTTPHeader(key string) {
	deleteHTTPHeaderInStringMap(req.Headers, key)
}

// GetHTTPHeader gets the first value associated with the given key. If
// there are no values associated with the key, Get returns "".
// It is case-insensitive; textproto.CanonicalMIMEHeaderKey is
// used to canonicalize the provided key. Get assumes that all
// keys are stored in canonical form.
func (req *SubscribeStreamRequest) GetHTTPHeader(key string) string {
	return req.GetHTTPHeaders().Get(key)
}

// GetHTTPHeaders returns HTTP headers.
func (req *SubscribeStreamRequest) GetHTTPHeaders() http.Header {
	return getHTTPHeadersFromStringMap(req.Headers)
}

// SubscribeStreamStatus is a status of subscription response.
type SubscribeStreamStatus int32

const (
	// SubscribeStreamStatusOK means subscription is allowed.
	SubscribeStreamStatusOK SubscribeStreamStatus = 0
	// SubscribeStreamStatusNotFound means stream does not exist at all.
	SubscribeStreamStatusNotFound SubscribeStreamStatus = 1
	// SubscribeStreamStatusPermissionDenied means that user is not allowed to subscribe.
	SubscribeStreamStatusPermissionDenied SubscribeStreamStatus = 2
)

// SubscribeStreamResponse represents a response for a subscribe stream call.
type SubscribeStreamResponse struct {
	Status      SubscribeStreamStatus
	InitialData *InitialData
}

// InitialData to send to a client upon a successful subscription to a channel.
type InitialData struct {
	data []byte
}

// Data allows to get prepared bytes of initial data.
func (d *InitialData) Data() []byte {
	return d.data
}

// NewInitialFrame allows creating frame as subscription InitialData.
func NewInitialFrame(frame *data.Frame, include data.FrameInclude) (*InitialData, error) {
	frameJSON, err := data.FrameToJSON(frame, include)
	if err != nil {
		return nil, err
	}
	return &InitialData{
		data: frameJSON,
	}, nil
}

// NewInitialData allows sending JSON on subscription
func NewInitialData(data json.RawMessage) (*InitialData, error) {
	if !json.Valid(data) {
		return nil, fmt.Errorf("invalid JSON data")
	}
	return &InitialData{
		data: data,
	}, nil
}

// PublishStreamRequest represents a request for a publish stream call.
type PublishStreamRequest struct {
	PluginContext PluginContext
	Path          string
	Data          json.RawMessage

	// Headers the environment/metadata information for the request.
	// To access forwarded HTTP headers please use GetHTTPHeaders or GetHTTPHeader.
	Headers map[string]string
}

// SetHTTPHeader sets the header entries associated with key to the
// single element value. It replaces any existing values
// associated with key. The key is case-insensitive; it is
// canonicalized by textproto.CanonicalMIMEHeaderKey.
func (req *PublishStreamRequest) SetHTTPHeader(key, value string) {
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}

	setHTTPHeaderInStringMap(req.Headers, key, value)
}

// DeleteHTTPHeader deletes the values associated with key.
// The key is case-insensitive; it is canonicalized by
// CanonicalHeaderKey.
func (req *PublishStreamRequest) DeleteHTTPHeader(key string) {
	deleteHTTPHeaderInStringMap(req.Headers, key)
}

// GetHTTPHeader gets the first value associated with the given key. If
// there are no values associated with the key, Get returns "".
// It is case-insensitive; textproto.CanonicalMIMEHeaderKey is
// used to canonicalize the provided key. Get assumes that all
// keys are stored in canonical form.
func (req *PublishStreamRequest) GetHTTPHeader(key string) string {
	return req.GetHTTPHeaders().Get(key)
}

// GetHTTPHeaders returns HTTP headers.
func (req *PublishStreamRequest) GetHTTPHeaders() http.Header {
	return getHTTPHeadersFromStringMap(req.Headers)
}

// PublishStreamStatus is a status of publication response.
type PublishStreamStatus int32

const (
	// PublishStreamStatusOK means publication is allowed.
	PublishStreamStatusOK PublishStreamStatus = 0
	// PublishStreamStatusNotFound means stream does not exist at all.
	PublishStreamStatusNotFound PublishStreamStatus = 1
	// PublishStreamStatusPermissionDenied means that user is not allowed to publish.
	PublishStreamStatusPermissionDenied PublishStreamStatus = 2
)

// PublishStreamResponse represents a response for a publish stream call.
type PublishStreamResponse struct {
	Status PublishStreamStatus
	Data   json.RawMessage
}

// RunStreamRequest represents a request for a run stream call.
type RunStreamRequest struct {
	PluginContext PluginContext
	Path          string
	Data          json.RawMessage

	// Headers the environment/metadata information for the request.
	// To access forwarded HTTP headers please use GetHTTPHeaders or GetHTTPHeader.
	Headers map[string]string
}

// SetHTTPHeader sets the header entries associated with key to the
// single element value. It replaces any existing values
// associated with key. The key is case-insensitive; it is
// canonicalized by textproto.CanonicalMIMEHeaderKey.
func (req *RunStreamRequest) SetHTTPHeader(key, value string) {
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}

	setHTTPHeaderInStringMap(req.Headers, key, value)
}

// DeleteHTTPHeader deletes the values associated with key.
// The key is case-insensitive; it is canonicalized by
// CanonicalHeaderKey.
func (req *RunStreamRequest) DeleteHTTPHeader(key string) {
	deleteHTTPHeaderInStringMap(req.Headers, key)
}

// GetHTTPHeader gets the first value associated with the given key. If
// there are no values associated with the key, Get returns "".
// It is case-insensitive; textproto.CanonicalMIMEHeaderKey is
// used to canonicalize the provided key. Get assumes that all
// keys are stored in canonical form.
func (req *RunStreamRequest) GetHTTPHeader(key string) string {
	return req.GetHTTPHeaders().Get(key)
}

// GetHTTPHeaders returns HTTP headers.
func (req *RunStreamRequest) GetHTTPHeaders() http.Header {
	return getHTTPHeadersFromStringMap(req.Headers)
}

// StreamPacket represents a stream packet.
type StreamPacket struct {
	Data json.RawMessage
}

// StreamPacketSender is used for sending StreamPacket responses.
type StreamPacketSender interface {
	Send(*StreamPacket) error
}

// StreamSender allows sending data to a stream.
type StreamSender struct {
	packetSender StreamPacketSender
}

// NewStreamSender createa a new StreamSender.
func NewStreamSender(packetSender StreamPacketSender) *StreamSender {
	return &StreamSender{packetSender: packetSender}
}

// SendFrame allows sending data.Frame to a stream.
func (s *StreamSender) SendFrame(frame *data.Frame, include data.FrameInclude) error {
	frameJSON, err := data.FrameToJSON(frame, include)
	if err != nil {
		return err
	}
	packet := &pluginv2.StreamPacket{
		Data: frameJSON,
	}
	return s.packetSender.Send(FromProto().StreamPacket(packet))
}

// SendJSON allow sending arbitrary JSON to a stream. When sending data.Frame
// prefer using SendFrame method.
func (s *StreamSender) SendJSON(data []byte) error {
	if !json.Valid(data) {
		return fmt.Errorf("invalid JSON data")
	}
	packet := &pluginv2.StreamPacket{
		Data: data,
	}
	return s.packetSender.Send(FromProto().StreamPacket(packet))
}

// SendBytes allow sending arbitrary Bytes to a stream. When sending data.Frame
// prefer using SendFrame method. When sending an arbitrary raw JSON prefer
// using SendJSON method.
func (s *StreamSender) SendBytes(data []byte) error {
	packet := &pluginv2.StreamPacket{
		Data: data,
	}
	return s.packetSender.Send(FromProto().StreamPacket(packet))
}

var _ ForwardHTTPHeaders = (*SubscribeStreamRequest)(nil)
var _ ForwardHTTPHeaders = (*PublishStreamRequest)(nil)
var _ ForwardHTTPHeaders = (*RunStreamRequest)(nil)
