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

// API/gRPC features intentionally missing from this client:
// - You cannot have the server pick the time of the entry. This client
//   always sends a time.
// - There is no way to provide a protocol buffer payload.
// - No support for the "partial success" feature when writing log entries.

// TODO(jba): test whether forward-slash characters in the log ID must be URL-encoded.
// These features are missing now, but will likely be added:
// - There is no way to specify CallOptions.

package logging

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/internal/version"
	vkit "cloud.google.com/go/logging/apiv2"
	"cloud.google.com/go/logging/internal"
	"github.com/golang/protobuf/proto"
	"github.com/golang/protobuf/ptypes"
	structpb "github.com/golang/protobuf/ptypes/struct"
	tspb "github.com/golang/protobuf/ptypes/timestamp"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/api/support/bundler"
	mrpb "google.golang.org/genproto/googleapis/api/monitoredres"
	logtypepb "google.golang.org/genproto/googleapis/logging/type"
	logpb "google.golang.org/genproto/googleapis/logging/v2"
)

const (
	// Scope for reading from the logging service.
	ReadScope = "https://www.googleapis.com/auth/logging.read"

	// Scope for writing to the logging service.
	WriteScope = "https://www.googleapis.com/auth/logging.write"

	// Scope for administrative actions on the logging service.
	AdminScope = "https://www.googleapis.com/auth/logging.admin"
)

const (
	// defaultErrorCapacity is the capacity of the channel used to deliver
	// errors to the OnError function.
	defaultErrorCapacity = 10

	// DefaultDelayThreshold is the default value for the DelayThreshold LoggerOption.
	DefaultDelayThreshold = time.Second

	// DefaultEntryCountThreshold is the default value for the EntryCountThreshold LoggerOption.
	DefaultEntryCountThreshold = 1000

	// DefaultEntryByteThreshold is the default value for the EntryByteThreshold LoggerOption.
	DefaultEntryByteThreshold = 1 << 20 // 1MiB

	// DefaultBufferedByteLimit is the default value for the BufferedByteLimit LoggerOption.
	DefaultBufferedByteLimit = 1 << 30 // 1GiB
)

// For testing:
var now = time.Now

// ErrOverflow signals that the number of buffered entries for a Logger
// exceeds its BufferLimit.
var ErrOverflow = bundler.ErrOverflow

// ErrOversizedEntry signals that an entry's size exceeds the maximum number of
// bytes that will be sent in a single call to the logging service.
var ErrOversizedEntry = bundler.ErrOversizedItem

// Client is a Logging client. A Client is associated with a single Cloud project.
type Client struct {
	client    *vkit.Client // client for the logging service
	projectID string
	errc      chan error     // should be buffered to minimize dropped errors
	donec     chan struct{}  // closed on Client.Close to close Logger bundlers
	loggers   sync.WaitGroup // so we can wait for loggers to close
	closed    bool

	mu      sync.Mutex
	nErrs   int   // number of errors we saw
	lastErr error // last error we saw

	// OnError is called when an error occurs in a call to Log or Flush. The
	// error may be due to an invalid Entry, an overflow because BufferLimit
	// was reached (in which case the error will be ErrOverflow) or an error
	// communicating with the logging service. OnError is called with errors
	// from all Loggers. It is never called concurrently. OnError is expected
	// to return quickly; if errors occur while OnError is running, some may
	// not be reported. The default behavior is to call log.Printf.
	//
	// This field should be set only once, before any method of Client is called.
	OnError func(err error)
}

// NewClient returns a new logging client associated with the provided project ID.
//
// By default NewClient uses WriteScope. To use a different scope, call
// NewClient using a WithScopes option (see https://godoc.org/google.golang.org/api/option#WithScopes).
func NewClient(ctx context.Context, projectID string, opts ...option.ClientOption) (*Client, error) {
	// Check for '/' in project ID to reserve the ability to support various owning resources,
	// in the form "{Collection}/{Name}", for instance "organizations/my-org".
	if strings.ContainsRune(projectID, '/') {
		return nil, errors.New("logging: project ID contains '/'")
	}
	opts = append([]option.ClientOption{
		option.WithEndpoint(internal.ProdAddr),
		option.WithScopes(WriteScope),
	}, opts...)
	c, err := vkit.NewClient(ctx, opts...)
	if err != nil {
		return nil, err
	}
	c.SetGoogleClientInfo("gccl", version.Repo)
	client := &Client{
		client:    c,
		projectID: projectID,
		errc:      make(chan error, defaultErrorCapacity), // create a small buffer for errors
		donec:     make(chan struct{}),
		OnError:   func(e error) { log.Printf("logging client: %v", e) },
	}
	// Call the user's function synchronously, to make life easier for them.
	go func() {
		for err := range client.errc {
			// This reference to OnError is memory-safe if the user sets OnError before
			// calling any client methods. The reference happens before the first read from
			// client.errc, which happens before the first write to client.errc, which
			// happens before any call, which happens before the user sets OnError.
			if fn := client.OnError; fn != nil {
				fn(err)
			} else {
				log.Printf("logging (project ID %q): %v", projectID, err)
			}
		}
	}()
	return client, nil
}

// parent returns the string used in many RPCs to denote the parent resource of the log.
func (c *Client) parent() string {
	return "projects/" + c.projectID
}

var unixZeroTimestamp *tspb.Timestamp

func init() {
	var err error
	unixZeroTimestamp, err = ptypes.TimestampProto(time.Unix(0, 0))
	if err != nil {
		panic(err)
	}
}

// Ping reports whether the client's connection to the logging service and the
// authentication configuration are valid. To accomplish this, Ping writes a
// log entry "ping" to a log named "ping".
func (c *Client) Ping(ctx context.Context) error {
	ent := &logpb.LogEntry{
		Payload:   &logpb.LogEntry_TextPayload{TextPayload: "ping"},
		Timestamp: unixZeroTimestamp, // Identical timestamps and insert IDs are both
		InsertId:  "ping",            // necessary for the service to dedup these entries.
	}
	_, err := c.client.WriteLogEntries(ctx, &logpb.WriteLogEntriesRequest{
		LogName:  internal.LogPath(c.parent(), "ping"),
		Resource: globalResource(c.projectID),
		Entries:  []*logpb.LogEntry{ent},
	})
	return err
}

// error puts the error on the client's error channel
// without blocking, and records summary error info.
func (c *Client) error(err error) {
	select {
	case c.errc <- err:
	default:
	}
	c.mu.Lock()
	c.lastErr = err
	c.nErrs++
	c.mu.Unlock()
}

func (c *Client) extractErrorInfo() error {
	var err error
	c.mu.Lock()
	if c.lastErr != nil {
		err = fmt.Errorf("saw %d errors; last: %v", c.nErrs, c.lastErr)
		c.nErrs = 0
		c.lastErr = nil
	}
	c.mu.Unlock()
	return err
}

// A Logger is used to write log messages to a single log. It can be configured
// with a log ID, common monitored resource, and a set of common labels.
type Logger struct {
	client     *Client
	logName    string // "projects/{projectID}/logs/{logID}"
	stdLoggers map[Severity]*log.Logger
	bundler    *bundler.Bundler

	// Options
	commonResource *mrpb.MonitoredResource
	commonLabels   map[string]string
}

// A LoggerOption is a configuration option for a Logger.
type LoggerOption interface {
	set(*Logger)
}

// CommonResource sets the monitored resource associated with all log entries
// written from a Logger. If not provided, the resource is automatically
// detected based on the running environment.  This value can be overridden
// per-entry by setting an Entry's Resource field.
func CommonResource(r *mrpb.MonitoredResource) LoggerOption { return commonResource{r} }

type commonResource struct{ *mrpb.MonitoredResource }

func (r commonResource) set(l *Logger) { l.commonResource = r.MonitoredResource }

var detectedResource struct {
	pb   *mrpb.MonitoredResource
	once sync.Once
}

func detectResource() *mrpb.MonitoredResource {
	detectedResource.once.Do(func() {
		if !metadata.OnGCE() {
			return
		}
		projectID, err := metadata.ProjectID()
		if err != nil {
			return
		}
		id, err := metadata.InstanceID()
		if err != nil {
			return
		}
		zone, err := metadata.Zone()
		if err != nil {
			return
		}
		detectedResource.pb = &mrpb.MonitoredResource{
			Type: "gce_instance",
			Labels: map[string]string{
				"project_id":  projectID,
				"instance_id": id,
				"zone":        zone,
			},
		}
	})
	return detectedResource.pb
}

func globalResource(projectID string) *mrpb.MonitoredResource {
	return &mrpb.MonitoredResource{
		Type: "global",
		Labels: map[string]string{
			"project_id": projectID,
		},
	}
}

// CommonLabels are labels that apply to all log entries written from a Logger,
// so that you don't have to repeat them in each log entry's Labels field. If
// any of the log entries contains a (key, value) with the same key that is in
// CommonLabels, then the entry's (key, value) overrides the one in
// CommonLabels.
func CommonLabels(m map[string]string) LoggerOption { return commonLabels(m) }

type commonLabels map[string]string

func (c commonLabels) set(l *Logger) { l.commonLabels = c }

// DelayThreshold is the maximum amount of time that an entry should remain
// buffered in memory before a call to the logging service is triggered. Larger
// values of DelayThreshold will generally result in fewer calls to the logging
// service, while increasing the risk that log entries will be lost if the
// process crashes.
// The default is DefaultDelayThreshold.
func DelayThreshold(d time.Duration) LoggerOption { return delayThreshold(d) }

type delayThreshold time.Duration

func (d delayThreshold) set(l *Logger) { l.bundler.DelayThreshold = time.Duration(d) }

// EntryCountThreshold is the maximum number of entries that will be buffered
// in memory before a call to the logging service is triggered. Larger values
// will generally result in fewer calls to the logging service, while
// increasing both memory consumption and the risk that log entries will be
// lost if the process crashes.
// The default is DefaultEntryCountThreshold.
func EntryCountThreshold(n int) LoggerOption { return entryCountThreshold(n) }

type entryCountThreshold int

func (e entryCountThreshold) set(l *Logger) { l.bundler.BundleCountThreshold = int(e) }

// EntryByteThreshold is the maximum number of bytes of entries that will be
// buffered in memory before a call to the logging service is triggered. See
// EntryCountThreshold for a discussion of the tradeoffs involved in setting
// this option.
// The default is DefaultEntryByteThreshold.
func EntryByteThreshold(n int) LoggerOption { return entryByteThreshold(n) }

type entryByteThreshold int

func (e entryByteThreshold) set(l *Logger) { l.bundler.BundleByteThreshold = int(e) }

// EntryByteLimit is the maximum number of bytes of entries that will be sent
// in a single call to the logging service. ErrOversizedEntry is returned if an
// entry exceeds EntryByteLimit. This option limits the size of a single RPC
// payload, to account for network or service issues with large RPCs. If
// EntryByteLimit is smaller than EntryByteThreshold, the latter has no effect.
// The default is zero, meaning there is no limit.
func EntryByteLimit(n int) LoggerOption { return entryByteLimit(n) }

type entryByteLimit int

func (e entryByteLimit) set(l *Logger) { l.bundler.BundleByteLimit = int(e) }

// BufferedByteLimit is the maximum number of bytes that the Logger will keep
// in memory before returning ErrOverflow. This option limits the total memory
// consumption of the Logger (but note that each Logger has its own, separate
// limit). It is possible to reach BufferedByteLimit even if it is larger than
// EntryByteThreshold or EntryByteLimit, because calls triggered by the latter
// two options may be enqueued (and hence occupying memory) while new log
// entries are being added.
// The default is DefaultBufferedByteLimit.
func BufferedByteLimit(n int) LoggerOption { return bufferedByteLimit(n) }

type bufferedByteLimit int

func (b bufferedByteLimit) set(l *Logger) { l.bundler.BufferedByteLimit = int(b) }

// Logger returns a Logger that will write entries with the given log ID, such as
// "syslog". A log ID must be less than 512 characters long and can only
// include the following characters: upper and lower case alphanumeric
// characters: [A-Za-z0-9]; and punctuation characters: forward-slash,
// underscore, hyphen, and period.
func (c *Client) Logger(logID string, opts ...LoggerOption) *Logger {
	r := detectResource()
	if r == nil {
		r = globalResource(c.projectID)
	}
	l := &Logger{
		client:         c,
		logName:        internal.LogPath(c.parent(), logID),
		commonResource: r,
	}
	// TODO(jba): determine the right context for the bundle handler.
	ctx := context.TODO()
	l.bundler = bundler.NewBundler(&logpb.LogEntry{}, func(entries interface{}) {
		l.writeLogEntries(ctx, entries.([]*logpb.LogEntry))
	})
	l.bundler.DelayThreshold = DefaultDelayThreshold
	l.bundler.BundleCountThreshold = DefaultEntryCountThreshold
	l.bundler.BundleByteThreshold = DefaultEntryByteThreshold
	l.bundler.BufferedByteLimit = DefaultBufferedByteLimit
	for _, opt := range opts {
		opt.set(l)
	}

	l.stdLoggers = map[Severity]*log.Logger{}
	for s := range severityName {
		l.stdLoggers[s] = log.New(severityWriter{l, s}, "", 0)
	}
	c.loggers.Add(1)
	go func() {
		defer c.loggers.Done()
		<-c.donec
		l.bundler.Flush()
	}()
	return l
}

type severityWriter struct {
	l *Logger
	s Severity
}

func (w severityWriter) Write(p []byte) (n int, err error) {
	w.l.Log(Entry{
		Severity: w.s,
		Payload:  string(p),
	})
	return len(p), nil
}

// Close waits for all opened loggers to be flushed and closes the client.
func (c *Client) Close() error {
	if c.closed {
		return nil
	}
	close(c.donec)   // close Logger bundlers
	c.loggers.Wait() // wait for all bundlers to flush and close
	// Now there can be no more errors.
	close(c.errc) // terminate error goroutine
	// Prefer logging errors to close errors.
	err := c.extractErrorInfo()
	err2 := c.client.Close()
	if err == nil {
		err = err2
	}
	c.closed = true
	return err
}

// Severity is the severity of the event described in a log entry. These
// guideline severity levels are ordered, with numerically smaller levels
// treated as less severe than numerically larger levels.
type Severity int

const (
	// Default means the log entry has no assigned severity level.
	Default = Severity(logtypepb.LogSeverity_DEFAULT)
	// Debug means debug or trace information.
	Debug = Severity(logtypepb.LogSeverity_DEBUG)
	// Info means routine information, such as ongoing status or performance.
	Info = Severity(logtypepb.LogSeverity_INFO)
	// Notice means normal but significant events, such as start up, shut down, or configuration.
	Notice = Severity(logtypepb.LogSeverity_NOTICE)
	// Warning means events that might cause problems.
	Warning = Severity(logtypepb.LogSeverity_WARNING)
	// Error means events that are likely to cause problems.
	Error = Severity(logtypepb.LogSeverity_ERROR)
	// Critical means events that cause more severe problems or brief outages.
	Critical = Severity(logtypepb.LogSeverity_CRITICAL)
	// Alert means a person must take an action immediately.
	Alert = Severity(logtypepb.LogSeverity_ALERT)
	// Emergency means one or more systems are unusable.
	Emergency = Severity(logtypepb.LogSeverity_EMERGENCY)
)

var severityName = map[Severity]string{
	Default:   "Default",
	Debug:     "Debug",
	Info:      "Info",
	Notice:    "Notice",
	Warning:   "Warning",
	Error:     "Error",
	Critical:  "Critical",
	Alert:     "Alert",
	Emergency: "Emergency",
}

// String converts a severity level to a string.
func (v Severity) String() string {
	// same as proto.EnumName
	s, ok := severityName[v]
	if ok {
		return s
	}
	return strconv.Itoa(int(v))
}

// ParseSeverity returns the Severity whose name equals s, ignoring case. It
// returns Default if no Severity matches.
func ParseSeverity(s string) Severity {
	sl := strings.ToLower(s)
	for sev, name := range severityName {
		if strings.ToLower(name) == sl {
			return sev
		}
	}
	return Default
}

// Entry is a log entry.
// See https://cloud.google.com/logging/docs/view/logs_index for more about entries.
type Entry struct {
	// Timestamp is the time of the entry. If zero, the current time is used.
	Timestamp time.Time

	// Severity is the entry's severity level.
	// The zero value is Default.
	Severity Severity

	// Payload must be either a string or something that
	// marshals via the encoding/json package to a JSON object
	// (and not any other type of JSON value).
	Payload interface{}

	// Labels optionally specifies key/value labels for the log entry.
	// The Logger.Log method takes ownership of this map. See Logger.CommonLabels
	// for more about labels.
	Labels map[string]string

	// InsertID is a unique ID for the log entry. If you provide this field,
	// the logging service considers other log entries in the same log with the
	// same ID as duplicates which can be removed. If omitted, the logging
	// service will generate a unique ID for this log entry. Note that because
	// this client retries RPCs automatically, it is possible (though unlikely)
	// that an Entry without an InsertID will be written more than once.
	InsertID string

	// HTTPRequest optionally specifies metadata about the HTTP request
	// associated with this log entry, if applicable. It is optional.
	HTTPRequest *HTTPRequest

	// Operation optionally provides information about an operation associated
	// with the log entry, if applicable.
	Operation *logpb.LogEntryOperation

	// LogName is the full log name, in the form
	// "projects/{ProjectID}/logs/{LogID}". It is set by the client when
	// reading entries. It is an error to set it when writing entries.
	LogName string

	// Resource is the monitored resource associated with the entry. It is set
	// by the client when reading entries. It is an error to set it when
	// writing entries.
	Resource *mrpb.MonitoredResource

	// Trace is the resource name of the trace associated with the log entry,
	// if any. If it contains a relative resource name, the name is assumed to
	// be relative to //tracing.googleapis.com.
	Trace string
}

// HTTPRequest contains an http.Request as well as additional
// information about the request and its response.
type HTTPRequest struct {
	// Request is the http.Request passed to the handler.
	Request *http.Request

	// RequestSize is the size of the HTTP request message in bytes, including
	// the request headers and the request body.
	RequestSize int64

	// Status is the response code indicating the status of the response.
	// Examples: 200, 404.
	Status int

	// ResponseSize is the size of the HTTP response message sent back to the client, in bytes,
	// including the response headers and the response body.
	ResponseSize int64

	// Latency is the request processing latency on the server, from the time the request was
	// received until the response was sent.
	Latency time.Duration

	// LocalIP is the IP address (IPv4 or IPv6) of the origin server that the request
	// was sent to.
	LocalIP string

	// RemoteIP is the IP address (IPv4 or IPv6) of the client that issued the
	// HTTP request. Examples: "192.168.1.1", "FE80::0202:B3FF:FE1E:8329".
	RemoteIP string

	// CacheHit reports whether an entity was served from cache (with or without
	// validation).
	CacheHit bool

	// CacheValidatedWithOriginServer reports whether the response was
	// validated with the origin server before being served from cache. This
	// field is only meaningful if CacheHit is true.
	CacheValidatedWithOriginServer bool
}

func fromHTTPRequest(r *HTTPRequest) *logtypepb.HttpRequest {
	if r == nil {
		return nil
	}
	if r.Request == nil {
		panic("HTTPRequest must have a non-nil Request")
	}
	u := *r.Request.URL
	u.Fragment = ""
	pb := &logtypepb.HttpRequest{
		RequestMethod:                  r.Request.Method,
		RequestUrl:                     u.String(),
		RequestSize:                    r.RequestSize,
		Status:                         int32(r.Status),
		ResponseSize:                   r.ResponseSize,
		UserAgent:                      r.Request.UserAgent(),
		ServerIp:                       r.LocalIP,
		RemoteIp:                       r.RemoteIP, // TODO(jba): attempt to parse http.Request.RemoteAddr?
		Referer:                        r.Request.Referer(),
		CacheHit:                       r.CacheHit,
		CacheValidatedWithOriginServer: r.CacheValidatedWithOriginServer,
	}
	if r.Latency != 0 {
		pb.Latency = ptypes.DurationProto(r.Latency)
	}
	return pb
}

// toProtoStruct converts v, which must marshal into a JSON object,
// into a Google Struct proto.
func toProtoStruct(v interface{}) (*structpb.Struct, error) {
	// Fast path: if v is already a *structpb.Struct, nothing to do.
	if s, ok := v.(*structpb.Struct); ok {
		return s, nil
	}
	// v is a Go struct that supports JSON marshalling. We want a Struct
	// protobuf. Some day we may have a more direct way to get there, but right
	// now the only way is to marshal the Go struct to JSON, unmarshal into a
	// map, and then build the Struct proto from the map.
	jb, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("logging: json.Marshal: %v", err)
	}
	var m map[string]interface{}
	err = json.Unmarshal(jb, &m)
	if err != nil {
		return nil, fmt.Errorf("logging: json.Unmarshal: %v", err)
	}
	return jsonMapToProtoStruct(m), nil
}

func jsonMapToProtoStruct(m map[string]interface{}) *structpb.Struct {
	fields := map[string]*structpb.Value{}
	for k, v := range m {
		fields[k] = jsonValueToStructValue(v)
	}
	return &structpb.Struct{Fields: fields}
}

func jsonValueToStructValue(v interface{}) *structpb.Value {
	switch x := v.(type) {
	case bool:
		return &structpb.Value{Kind: &structpb.Value_BoolValue{BoolValue: x}}
	case float64:
		return &structpb.Value{Kind: &structpb.Value_NumberValue{NumberValue: x}}
	case string:
		return &structpb.Value{Kind: &structpb.Value_StringValue{StringValue: x}}
	case nil:
		return &structpb.Value{Kind: &structpb.Value_NullValue{}}
	case map[string]interface{}:
		return &structpb.Value{Kind: &structpb.Value_StructValue{StructValue: jsonMapToProtoStruct(x)}}
	case []interface{}:
		var vals []*structpb.Value
		for _, e := range x {
			vals = append(vals, jsonValueToStructValue(e))
		}
		return &structpb.Value{Kind: &structpb.Value_ListValue{ListValue: &structpb.ListValue{Values: vals}}}
	default:
		panic(fmt.Sprintf("bad type %T for JSON value", v))
	}
}

// LogSync logs the Entry synchronously without any buffering. Because LogSync is slow
// and will block, it is intended primarily for debugging or critical errors.
// Prefer Log for most uses.
// TODO(jba): come up with a better name (LogNow?) or eliminate.
func (l *Logger) LogSync(ctx context.Context, e Entry) error {
	ent, err := toLogEntry(e)
	if err != nil {
		return err
	}
	_, err = l.client.client.WriteLogEntries(ctx, &logpb.WriteLogEntriesRequest{
		LogName:  l.logName,
		Resource: l.commonResource,
		Labels:   l.commonLabels,
		Entries:  []*logpb.LogEntry{ent},
	})
	return err
}

// Log buffers the Entry for output to the logging service. It never blocks.
func (l *Logger) Log(e Entry) {
	ent, err := toLogEntry(e)
	if err != nil {
		l.client.error(err)
		return
	}
	if err := l.bundler.Add(ent, proto.Size(ent)); err != nil {
		l.client.error(err)
	}
}

// Flush blocks until all currently buffered log entries are sent.
//
// If any errors occurred since the last call to Flush from any Logger, or the
// creation of the client if this is the first call, then Flush returns a non-nil
// error with summary information about the errors. This information is unlikely to
// be actionable. For more accurate error reporting, set Client.OnError.
func (l *Logger) Flush() error {
	l.bundler.Flush()
	return l.client.extractErrorInfo()
}

func (l *Logger) writeLogEntries(ctx context.Context, entries []*logpb.LogEntry) {
	req := &logpb.WriteLogEntriesRequest{
		LogName:  l.logName,
		Resource: l.commonResource,
		Labels:   l.commonLabels,
		Entries:  entries,
	}
	_, err := l.client.client.WriteLogEntries(ctx, req)
	if err != nil {
		l.client.error(err)
	}
}

// StandardLogger returns a *log.Logger for the provided severity.
//
// This method is cheap. A single log.Logger is pre-allocated for each
// severity level in each Logger. Callers may mutate the returned log.Logger
// (for example by calling SetFlags or SetPrefix).
func (l *Logger) StandardLogger(s Severity) *log.Logger { return l.stdLoggers[s] }

func trunc32(i int) int32 {
	if i > math.MaxInt32 {
		i = math.MaxInt32
	}
	return int32(i)
}

func toLogEntry(e Entry) (*logpb.LogEntry, error) {
	if e.LogName != "" {
		return nil, errors.New("logging: Entry.LogName should be not be set when writing")
	}
	t := e.Timestamp
	if t.IsZero() {
		t = now()
	}
	ts, err := ptypes.TimestampProto(t)
	if err != nil {
		return nil, err
	}
	ent := &logpb.LogEntry{
		Timestamp:   ts,
		Severity:    logtypepb.LogSeverity(e.Severity),
		InsertId:    e.InsertID,
		HttpRequest: fromHTTPRequest(e.HTTPRequest),
		Operation:   e.Operation,
		Labels:      e.Labels,
		Trace:       e.Trace,
	}

	switch p := e.Payload.(type) {
	case string:
		ent.Payload = &logpb.LogEntry_TextPayload{TextPayload: p}
	default:
		s, err := toProtoStruct(p)
		if err != nil {
			return nil, err
		}
		ent.Payload = &logpb.LogEntry_JsonPayload{JsonPayload: s}
	}
	return ent, nil
}
