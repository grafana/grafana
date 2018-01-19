// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package trace is a Google Stackdriver Trace library.
//
// This package is still experimental and subject to change.
//
// See https://cloud.google.com/trace/api/#data_model for a discussion of traces
// and spans.
//
// To initialize a client that connects to the Stackdriver Trace server, use the
// NewClient function. Generally you will want to do this on program
// initialization.
//
//   import "cloud.google.com/go/trace"
//   ...
//   traceClient, err = trace.NewClient(ctx, projectID)
//
// Calling SpanFromRequest will create a new trace span for an incoming HTTP
// request.  If the request contains a trace context header, it is used to
// determine the trace ID.  Otherwise, a new trace ID is created.
//
//   func handler(w http.ResponseWriter, r *http.Request) {
//     span := traceClient.SpanFromRequest(r)
//     defer span.Finish()
//     ...
//   }
//
// SpanFromRequest and NewSpan returns nil if the *Client is nil, so you can disable
// tracing by not initializing your *Client variable.  All of the exported
// functions on *Span do nothing when the *Span is nil.
//
// If you need to start traces that don't correspond to an incoming HTTP request,
// you can use NewSpan to create a root-level span.
//
//   span := traceClient.NewSpan("span name")
//   defer span.Finish()
//
// Although a trace span object is created for every request, only a subset of
// traces are uploaded to the server, for efficiency.  By default, the requests
// that are traced are those with the tracing bit set in the options field of
// the trace context header.  Ideally, you should override this behaviour by
// calling SetSamplingPolicy.  NewLimitedSampler returns an implementation of
// SamplingPolicy which traces requests that have the tracing bit set, and also
// randomly traces a specified fraction of requests.  Additionally, it sets a
// limit on the number of requests traced per second.  The following example
// traces one in every thousand requests, up to a limit of 5 per second.
//
//   p, err := trace.NewLimitedSampler(0.001, 5)
//   traceClient.SetSamplingPolicy(p)
//
// You can create a new span as a child of an existing span with NewChild.
//
//   childSpan := span.NewChild(name)
//   ...
//   childSpan.Finish()
//
// When sending an HTTP request to another server, NewRemoteChild will create
// a span to represent the time the current program waits for the request to
// complete, and attach a header to the outgoing request so that the trace will
// be propagated to the destination server.
//
//   childSpan := span.NewRemoteChild(&httpRequest)
//   ...
//   childSpan.Finish()
//
// Alternatively, if you have access to the X-Cloud-Trace-Context header value
// but not the underlying HTTP request (this can happen if you are using a
// different transport or messaging protocol, such as gRPC), you can use
// SpanFromHeader instead of SpanFromRequest. In that case, you will need to
// specify the span name explicility, since it cannot be constructed from the
// HTTP request's URL and method.
//
//   func handler(r *somepkg.Request) {
//     span := traceClient.SpanFromHeader("span name", r.TraceContext())
//     defer span.Finish()
//     ...
//   }
//
// Spans can contain a map from keys to values that have useful information
// about the span.  The elements of this map are called labels.  Some labels,
// whose keys all begin with the string "trace.cloud.google.com/", are set
// automatically in the following ways:
//
// - SpanFromRequest sets some labels to data about the incoming request.
//
// - NewRemoteChild sets some labels to data about the outgoing request.
//
// - Finish sets a label to a stack trace, if the stack trace option is enabled
// in the incoming trace header.
//
// - The WithResponse option sets some labels to data about a response.
// You can also set labels using SetLabel.  If a label is given a value
// automatically and by SetLabel, the automatically-set value is used.
//
//   span.SetLabel(key, value)
//
// The WithResponse option can be used when Finish is called.
//
//   childSpan := span.NewRemoteChild(outgoingReq)
//   resp, err := http.DefaultClient.Do(outgoingReq)
//   ...
//   childSpan.Finish(trace.WithResponse(resp))
//
// When a span created by SpanFromRequest or SpanFromHeader is finished, the
// finished spans in the corresponding trace -- the span itself and its
// descendants -- are uploaded to the Stackdriver Trace server using the
// *Client that created the span.  Finish returns immediately, and uploading
// occurs asynchronously.  You can use the FinishWait function instead to wait
// until uploading has finished.
//
//   err := span.FinishWait()
//
// Using contexts to pass *trace.Span objects through your program will often
// be a better approach than passing them around explicitly.  This allows trace
// spans, and other request-scoped or part-of-request-scoped values, to be
// easily passed through API boundaries.  Various Google Cloud libraries will
// retrieve trace spans from contexts and automatically create child spans for
// API requests.
// See https://blog.golang.org/context for more discussion of contexts.
// A derived context containing a trace span can be created using NewContext.
//
//   span := traceClient.SpanFromRequest(r)
//   ctx = trace.NewContext(ctx, span)
//
// The span can be retrieved from a context elsewhere in the program using
// FromContext.
//
//   func foo(ctx context.Context) {
//     span := trace.FromContext(ctx).NewChild("in foo")
//     defer span.Finish()
//     ...
//   }
//
package trace // import "cloud.google.com/go/trace"

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/net/context"
	api "google.golang.org/api/cloudtrace/v1"
	"google.golang.org/api/gensupport"
	"google.golang.org/api/option"
	"google.golang.org/api/support/bundler"
	htransport "google.golang.org/api/transport/http"
)

const (
	httpHeader          = `X-Cloud-Trace-Context`
	userAgent           = `gcloud-golang-trace/20160501`
	cloudPlatformScope  = `https://www.googleapis.com/auth/cloud-platform`
	spanKindClient      = `RPC_CLIENT`
	spanKindServer      = `RPC_SERVER`
	spanKindUnspecified = `SPAN_KIND_UNSPECIFIED`
	maxStackFrames      = 20
)

// Stackdriver Trace API predefined labels.
const (
	LabelAgent              = `trace.cloud.google.com/agent`
	LabelComponent          = `trace.cloud.google.com/component`
	LabelErrorMessage       = `trace.cloud.google.com/error/message`
	LabelErrorName          = `trace.cloud.google.com/error/name`
	LabelHTTPClientCity     = `trace.cloud.google.com/http/client_city`
	LabelHTTPClientCountry  = `trace.cloud.google.com/http/client_country`
	LabelHTTPClientProtocol = `trace.cloud.google.com/http/client_protocol`
	LabelHTTPClientRegion   = `trace.cloud.google.com/http/client_region`
	LabelHTTPHost           = `trace.cloud.google.com/http/host`
	LabelHTTPMethod         = `trace.cloud.google.com/http/method`
	LabelHTTPRedirectedURL  = `trace.cloud.google.com/http/redirected_url`
	LabelHTTPRequestSize    = `trace.cloud.google.com/http/request/size`
	LabelHTTPResponseSize   = `trace.cloud.google.com/http/response/size`
	LabelHTTPStatusCode     = `trace.cloud.google.com/http/status_code`
	LabelHTTPURL            = `trace.cloud.google.com/http/url`
	LabelHTTPUserAgent      = `trace.cloud.google.com/http/user_agent`
	LabelPID                = `trace.cloud.google.com/pid`
	LabelSamplingPolicy     = `trace.cloud.google.com/sampling_policy`
	LabelSamplingWeight     = `trace.cloud.google.com/sampling_weight`
	LabelStackTrace         = `trace.cloud.google.com/stacktrace`
	LabelTID                = `trace.cloud.google.com/tid`
)

const (
	// ScopeTraceAppend grants permissions to write trace data for a project.
	ScopeTraceAppend = "https://www.googleapis.com/auth/trace.append"

	// ScopeCloudPlatform grants permissions to view and manage your data
	// across Google Cloud Platform services.
	ScopeCloudPlatform = "https://www.googleapis.com/auth/cloud-platform"
)

type contextKey struct{}

type stackLabelValue struct {
	Frames []stackFrame `json:"stack_frame"`
}

type stackFrame struct {
	Class    string `json:"class_name,omitempty"`
	Method   string `json:"method_name"`
	Filename string `json:"file_name"`
	Line     int64  `json:"line_number"`
}

var (
	spanIDCounter   uint64
	spanIDIncrement uint64
)

func init() {
	// Set spanIDCounter and spanIDIncrement to random values.  nextSpanID will
	// return an arithmetic progression using these values, skipping zero.  We set
	// the LSB of spanIDIncrement to 1, so that the cycle length is 2^64.
	binary.Read(rand.Reader, binary.LittleEndian, &spanIDCounter)
	binary.Read(rand.Reader, binary.LittleEndian, &spanIDIncrement)
	spanIDIncrement |= 1
	// Attach hook for autogenerated Google API calls.  This will automatically
	// create trace spans for API calls if there is a trace in the context.
	gensupport.RegisterHook(requestHook)
}

func requestHook(ctx context.Context, req *http.Request) func(resp *http.Response) {
	span := FromContext(ctx)
	if span == nil || req == nil {
		return nil
	}
	span = span.NewRemoteChild(req)
	return func(resp *http.Response) {
		if resp != nil {
			span.Finish(WithResponse(resp))
		} else {
			span.Finish()
		}
	}
}

// nextSpanID returns a new span ID.  It will never return zero.
func nextSpanID() uint64 {
	var id uint64
	for id == 0 {
		id = atomic.AddUint64(&spanIDCounter, spanIDIncrement)
	}
	return id
}

// nextTraceID returns a new trace ID.
func nextTraceID() string {
	id1 := nextSpanID()
	id2 := nextSpanID()
	return fmt.Sprintf("%016x%016x", id1, id2)
}

// Client is a client for uploading traces to the Google Stackdriver Trace service.
// A nil Client will no-op for all of its methods.
type Client struct {
	service   *api.Service
	projectID string
	policy    SamplingPolicy
	bundler   *bundler.Bundler
}

// NewClient creates a new Google Stackdriver Trace client.
func NewClient(ctx context.Context, projectID string, opts ...option.ClientOption) (*Client, error) {
	o := []option.ClientOption{
		option.WithScopes(cloudPlatformScope),
		option.WithUserAgent(userAgent),
	}
	o = append(o, opts...)
	hc, basePath, err := htransport.NewClient(ctx, o...)
	if err != nil {
		return nil, fmt.Errorf("creating HTTP client for Google Stackdriver Trace API: %v", err)
	}
	apiService, err := api.New(hc)
	if err != nil {
		return nil, fmt.Errorf("creating Google Stackdriver Trace API client: %v", err)
	}
	if basePath != "" {
		// An option set a basepath, so override api.New's default.
		apiService.BasePath = basePath
	}
	c := &Client{
		service:   apiService,
		projectID: projectID,
	}
	bundler := bundler.NewBundler((*api.Trace)(nil), func(bundle interface{}) {
		traces := bundle.([]*api.Trace)
		err := c.upload(traces)
		if err != nil {
			log.Printf("failed to upload %d traces to the Cloud Trace server: %v", len(traces), err)
		}
	})
	bundler.DelayThreshold = 2 * time.Second
	bundler.BundleCountThreshold = 100
	// We're not measuring bytes here, we're counting traces and spans as one "byte" each.
	bundler.BundleByteThreshold = 1000
	bundler.BundleByteLimit = 1000
	bundler.BufferedByteLimit = 10000
	c.bundler = bundler
	return c, nil
}

// SetSamplingPolicy sets the SamplingPolicy that determines how often traces
// are initiated by this client.
func (c *Client) SetSamplingPolicy(p SamplingPolicy) {
	if c != nil {
		c.policy = p
	}
}

// SpanFromHeader returns a new trace span based on a provided request header
// value or nil iff the client is nil.
//
// The trace information and identifiers will be read from the header value.
// Otherwise, a new trace ID is made and the parent span ID is zero.
// For the exact format of the header value, see
// https://cloud.google.com/trace/docs/support#how_do_i_force_a_request_to_be_traced
//
// The name of the new span is provided as an argument.
//
// If a non-nil sampling policy has been set in the client, it can override
// the options set in the header and choose whether to trace the request.
//
// If the header doesn't have existing tracing information, then a *Span is
// returned anyway, but it will not be uploaded to the server, just as when
// calling SpanFromRequest on an untraced request.
//
// Most users using HTTP should use SpanFromRequest, rather than
// SpanFromHeader, since it provides additional functionality for HTTP
// requests. In particular, it will set various pieces of request information
// as labels on the *Span, which is not available from the header alone.
func (c *Client) SpanFromHeader(name string, header string) *Span {
	if c == nil {
		return nil
	}
	traceID, parentSpanID, options, _, ok := traceInfoFromHeader(header)
	if !ok {
		traceID = nextTraceID()
	}
	t := &trace{
		traceID:       traceID,
		client:        c,
		globalOptions: options,
		localOptions:  options,
	}
	span := startNewChild(name, t, parentSpanID)
	span.span.Kind = spanKindServer
	span.rootSpan = true
	configureSpanFromPolicy(span, c.policy, ok)
	return span
}

// SpanFromRequest returns a new trace span for an HTTP request or nil
// iff the client is nil.
//
// If the incoming HTTP request contains a trace context header, the trace ID,
// parent span ID, and tracing options will be read from that header.
// Otherwise, a new trace ID is made and the parent span ID is zero.
//
// If a non-nil sampling policy has been set in the client, it can override the
// options set in the header and choose whether to trace the request.
//
// If the request is not being traced, then a *Span is returned anyway, but it
// will not be uploaded to the server -- it is only useful for propagating
// trace context to child requests and for getting the TraceID.  All its
// methods can still be called -- the Finish, FinishWait, and SetLabel methods
// do nothing.  NewChild does nothing, and returns the same *Span.  TraceID
// works as usual.
func (c *Client) SpanFromRequest(r *http.Request) *Span {
	if c == nil {
		return nil
	}
	traceID, parentSpanID, options, _, ok := traceInfoFromHeader(r.Header.Get(httpHeader))
	if !ok {
		traceID = nextTraceID()
	}
	t := &trace{
		traceID:       traceID,
		client:        c,
		globalOptions: options,
		localOptions:  options,
	}
	span := startNewChildWithRequest(r, t, parentSpanID)
	span.span.Kind = spanKindServer
	span.rootSpan = true
	configureSpanFromPolicy(span, c.policy, ok)
	return span
}

// NewSpan returns a new trace span with the given name or nil iff the
// client is nil.
//
// A new trace and span ID is generated to trace the span.
// Returned span need to be finished by calling Finish or FinishWait.
func (c *Client) NewSpan(name string) *Span {
	if c == nil {
		return nil
	}
	t := &trace{
		traceID:       nextTraceID(),
		client:        c,
		localOptions:  optionTrace,
		globalOptions: optionTrace,
	}
	span := startNewChild(name, t, 0)
	span.span.Kind = spanKindUnspecified
	span.rootSpan = true
	configureSpanFromPolicy(span, c.policy, false)
	return span
}

func configureSpanFromPolicy(s *Span, p SamplingPolicy, ok bool) {
	if p == nil {
		return
	}
	d := p.Sample(Parameters{HasTraceHeader: ok})
	if d.Trace {
		// Turn on tracing locally, and in child requests.
		s.trace.localOptions |= optionTrace
		s.trace.globalOptions |= optionTrace
	} else {
		// Turn off tracing locally.
		s.trace.localOptions = 0
		return
	}
	if d.Sample {
		// This trace is in the random sample, so set the labels.
		s.SetLabel(LabelSamplingPolicy, d.Policy)
		s.SetLabel(LabelSamplingWeight, fmt.Sprint(d.Weight))
	}
}

// NewContext returns a derived context containing the span.
func NewContext(ctx context.Context, s *Span) context.Context {
	if s == nil {
		return ctx
	}
	return context.WithValue(ctx, contextKey{}, s)
}

// FromContext returns the span contained in the context, or nil.
func FromContext(ctx context.Context) *Span {
	s, _ := ctx.Value(contextKey{}).(*Span)
	return s
}

func traceInfoFromHeader(h string) (traceID string, spanID uint64, options optionFlags, optionsOk bool, ok bool) {
	// See https://cloud.google.com/trace/docs/faq for the header format.
	// Return if the header is empty or missing, or if the header is unreasonably
	// large, to avoid making unnecessary copies of a large string.
	if h == "" || len(h) > 200 {
		return "", 0, 0, false, false

	}

	// Parse the trace id field.
	slash := strings.Index(h, `/`)
	if slash == -1 {
		return "", 0, 0, false, false

	}
	traceID, h = h[:slash], h[slash+1:]

	// Parse the span id field.
	spanstr := h
	semicolon := strings.Index(h, `;`)
	if semicolon != -1 {
		spanstr, h = h[:semicolon], h[semicolon+1:]
	}
	spanID, err := strconv.ParseUint(spanstr, 10, 64)
	if err != nil {
		return "", 0, 0, false, false

	}

	// Parse the options field, options field is optional.
	if !strings.HasPrefix(h, "o=") {
		return traceID, spanID, 0, false, true

	}
	o, err := strconv.ParseUint(h[2:], 10, 64)
	if err != nil {
		return "", 0, 0, false, false

	}
	options = optionFlags(o)
	return traceID, spanID, options, true, true
}

type optionFlags uint32

const (
	optionTrace optionFlags = 1 << iota
	optionStack
)

type trace struct {
	mu            sync.Mutex
	client        *Client
	traceID       string
	globalOptions optionFlags // options that will be passed to any child requests
	localOptions  optionFlags // options applied in this server
	spans         []*Span     // finished spans for this trace.
}

// finish appends s to t.spans.  If s is the root span, uploads the trace to the
// server.
func (t *trace) finish(s *Span, wait bool, opts ...FinishOption) error {
	for _, o := range opts {
		o.modifySpan(s)
	}
	s.end = time.Now()
	t.mu.Lock()
	t.spans = append(t.spans, s)
	spans := t.spans
	t.mu.Unlock()
	if s.rootSpan {
		if wait {
			return t.client.upload([]*api.Trace{t.constructTrace(spans)})
		}
		go func() {
			tr := t.constructTrace(spans)
			err := t.client.bundler.Add(tr, 1+len(spans))
			if err == bundler.ErrOversizedItem {
				err = t.client.upload([]*api.Trace{tr})
			}
			if err != nil {
				log.Println("error uploading trace:", err)
			}
		}()
	}
	return nil
}

func (t *trace) constructTrace(spans []*Span) *api.Trace {
	apiSpans := make([]*api.TraceSpan, len(spans))
	for i, sp := range spans {
		sp.span.StartTime = sp.start.In(time.UTC).Format(time.RFC3339Nano)
		sp.span.EndTime = sp.end.In(time.UTC).Format(time.RFC3339Nano)
		if t.localOptions&optionStack != 0 {
			sp.setStackLabel()
		}
		if sp.host != "" {
			sp.SetLabel(LabelHTTPHost, sp.host)
		}
		if sp.url != "" {
			sp.SetLabel(LabelHTTPURL, sp.url)
		}
		if sp.method != "" {
			sp.SetLabel(LabelHTTPMethod, sp.method)
		}
		if sp.statusCode != 0 {
			sp.SetLabel(LabelHTTPStatusCode, strconv.Itoa(sp.statusCode))
		}
		apiSpans[i] = &sp.span
	}

	return &api.Trace{
		ProjectId: t.client.projectID,
		TraceId:   t.traceID,
		Spans:     apiSpans,
	}
}

func (c *Client) upload(traces []*api.Trace) error {
	_, err := c.service.Projects.PatchTraces(c.projectID, &api.Traces{Traces: traces}).Do()
	return err
}

// Span contains information about one span of a trace.
type Span struct {
	trace *trace

	spanMu sync.Mutex // guards span.Labels
	span   api.TraceSpan

	start      time.Time
	end        time.Time
	rootSpan   bool
	stack      [maxStackFrames]uintptr
	host       string
	method     string
	url        string
	statusCode int
}

// Traced reports whether the current span is sampled to be traced.
func (s *Span) Traced() bool {
	if s == nil {
		return false
	}
	return s.trace.localOptions&optionTrace != 0
}

// NewChild creates a new span with the given name as a child of s.
// If s is nil, does nothing and returns nil.
func (s *Span) NewChild(name string) *Span {
	if s == nil {
		return nil
	}
	if !s.Traced() {
		// TODO(jbd): Document this behavior in godoc here and elsewhere.
		return s
	}
	return startNewChild(name, s.trace, s.span.SpanId)
}

// NewRemoteChild creates a new span as a child of s.
//
// Some labels in the span are set from the outgoing *http.Request r.
//
// A header is set in r so that the trace context is propagated to the
// destination.  The parent span ID in that header is set as follows:
// - If the request is being traced, then the ID of s is used.
// - If the request is not being traced, but there was a trace context header
//   in the incoming request for this trace (the request passed to
//   SpanFromRequest), the parent span ID in that header is used.
// - Otherwise, the parent span ID is zero.
// The tracing bit in the options is set if tracing is enabled, or if it was
// set in the incoming request.
//
// If s is nil, does nothing and returns nil.
func (s *Span) NewRemoteChild(r *http.Request) *Span {
	if s == nil {
		return nil
	}
	if !s.Traced() {
		r.Header[httpHeader] = []string{spanHeader(s.trace.traceID, s.span.ParentSpanId, s.trace.globalOptions)}
		return s
	}
	newSpan := startNewChildWithRequest(r, s.trace, s.span.SpanId)
	r.Header[httpHeader] = []string{spanHeader(s.trace.traceID, newSpan.span.SpanId, s.trace.globalOptions)}
	return newSpan
}

// Header returns the value of the X-Cloud-Trace-Context header that
// should be used to propagate the span.  This is the inverse of
// SpanFromHeader.
//
// Most users should use NewRemoteChild unless they have specific
// propagation needs or want to control the naming of their span.
// Header() does not create a new span.
func (s *Span) Header() string {
	if s == nil {
		return ""
	}
	return spanHeader(s.trace.traceID, s.span.SpanId, s.trace.globalOptions)
}

func startNewChildWithRequest(r *http.Request, trace *trace, parentSpanID uint64) *Span {
	name := r.URL.Host + r.URL.Path // drop scheme and query params
	newSpan := startNewChild(name, trace, parentSpanID)
	if r.Host == "" {
		newSpan.host = r.URL.Host
	} else {
		newSpan.host = r.Host
	}
	newSpan.method = r.Method
	newSpan.url = r.URL.String()
	return newSpan
}

func startNewChild(name string, trace *trace, parentSpanID uint64) *Span {
	spanID := nextSpanID()
	for spanID == parentSpanID {
		spanID = nextSpanID()
	}
	newSpan := &Span{
		trace: trace,
		span: api.TraceSpan{
			Kind:         spanKindClient,
			Name:         name,
			ParentSpanId: parentSpanID,
			SpanId:       spanID,
		},
		start: time.Now(),
	}
	if trace.localOptions&optionStack != 0 {
		_ = runtime.Callers(1, newSpan.stack[:])
	}
	return newSpan
}

// TraceID returns the ID of the trace to which s belongs.
func (s *Span) TraceID() string {
	if s == nil {
		return ""
	}
	return s.trace.traceID
}

// SetLabel sets the label for the given key to the given value.
// If the value is empty, the label for that key is deleted.
// If a label is given a value automatically and by SetLabel, the
// automatically-set value is used.
// If s is nil, does nothing.
//
// SetLabel shouldn't be called after Finish or FinishWait.
func (s *Span) SetLabel(key, value string) {
	if s == nil {
		return
	}
	if !s.Traced() {
		return
	}
	s.spanMu.Lock()
	defer s.spanMu.Unlock()

	if value == "" {
		if s.span.Labels != nil {
			delete(s.span.Labels, key)
		}
		return
	}
	if s.span.Labels == nil {
		s.span.Labels = make(map[string]string)
	}
	s.span.Labels[key] = value
}

type FinishOption interface {
	modifySpan(s *Span)
}

type withResponse struct {
	*http.Response
}

// WithResponse returns an option that can be passed to Finish that indicates
// that some labels for the span should be set using the given *http.Response.
func WithResponse(resp *http.Response) FinishOption {
	return withResponse{resp}
}
func (u withResponse) modifySpan(s *Span) {
	if u.Response != nil {
		s.statusCode = u.StatusCode
	}
}

// Finish declares that the span has finished.
//
// If s is nil, Finish does nothing and returns nil.
//
// If the option trace.WithResponse(resp) is passed, then some labels are set
// for s using information in the given *http.Response.  This is useful when the
// span is for an outgoing http request; s will typically have been created by
// NewRemoteChild in this case.
//
// If s is a root span (one created by SpanFromRequest) then s, and all its
// descendant spans that have finished, are uploaded to the Google Stackdriver
// Trace server asynchronously.
func (s *Span) Finish(opts ...FinishOption) {
	if s == nil {
		return
	}
	if !s.Traced() {
		return
	}
	s.trace.finish(s, false, opts...)
}

// FinishWait is like Finish, but if s is a root span, it waits until uploading
// is finished, then returns an error if one occurred.
func (s *Span) FinishWait(opts ...FinishOption) error {
	if s == nil {
		return nil
	}
	if !s.Traced() {
		return nil
	}
	return s.trace.finish(s, true, opts...)
}

func spanHeader(traceID string, spanID uint64, options optionFlags) string {
	// See https://cloud.google.com/trace/docs/faq for the header format.
	return fmt.Sprintf("%s/%d;o=%d", traceID, spanID, options)
}

func (s *Span) setStackLabel() {
	var stack stackLabelValue
	lastSigPanic, inTraceLibrary := false, true
	for _, pc := range s.stack {
		if pc == 0 {
			break
		}
		if !lastSigPanic {
			pc--
		}
		fn := runtime.FuncForPC(pc)
		file, line := fn.FileLine(pc)
		// Name has one of the following forms:
		// path/to/package.Foo
		// path/to/package.(Type).Foo
		// For the first form, we store the whole name in the Method field of the
		// stack frame.  For the second form, we set the Method field to "Foo" and
		// the Class field to "path/to/package.(Type)".
		name := fn.Name()
		if inTraceLibrary && !strings.HasPrefix(name, "cloud.google.com/go/trace.") {
			inTraceLibrary = false
		}
		var class string
		if i := strings.Index(name, ")."); i != -1 {
			class, name = name[:i+1], name[i+2:]
		}
		frame := stackFrame{
			Class:    class,
			Method:   name,
			Filename: file,
			Line:     int64(line),
		}
		if inTraceLibrary && len(stack.Frames) == 1 {
			stack.Frames[0] = frame
		} else {
			stack.Frames = append(stack.Frames, frame)
		}
		lastSigPanic = fn.Name() == "runtime.sigpanic"
	}
	if label, err := json.Marshal(stack); err == nil {
		s.SetLabel(LabelStackTrace, string(label))
	}
}
