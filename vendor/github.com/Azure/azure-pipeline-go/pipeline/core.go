package pipeline

import (
	"context"
	"github.com/mattn/go-ieproxy"
	"net"
	"net/http"
	"os"
	"time"
)

// The Factory interface represents an object that can create its Policy object. Each HTTP request sent
// requires that this Factory create a new instance of its Policy object.
type Factory interface {
	New(next Policy, po *PolicyOptions) Policy
}

// FactoryFunc is an adapter that allows the use of an ordinary function as a Factory interface.
type FactoryFunc func(next Policy, po *PolicyOptions) PolicyFunc

// New calls f(next,po).
func (f FactoryFunc) New(next Policy, po *PolicyOptions) Policy {
	return f(next, po)
}

// The Policy interface represents a mutable Policy object created by a Factory. The object can mutate/process
// the HTTP request and then forward it on to the next Policy object in the linked-list. The returned
// Response goes backward through the linked-list for additional processing.
// NOTE: Request is passed by value so changes do not change the caller's version of
// the request. However, Request has some fields that reference mutable objects (not strings).
// These references are copied; a deep copy is not performed. Specifically, this means that
// you should avoid modifying the objects referred to by these fields: URL, Header, Body,
// GetBody, TransferEncoding, Form, MultipartForm, Trailer, TLS, Cancel, and Response.
type Policy interface {
	Do(ctx context.Context, request Request) (Response, error)
}

// PolicyFunc is an adapter that allows the use of an ordinary function as a Policy interface.
type PolicyFunc func(ctx context.Context, request Request) (Response, error)

// Do calls f(ctx, request).
func (f PolicyFunc) Do(ctx context.Context, request Request) (Response, error) {
	return f(ctx, request)
}

// Options configures a Pipeline's behavior.
type Options struct {
	HTTPSender Factory // If sender is nil, then the pipeline's default client is used to send the HTTP requests.
	Log        LogOptions
}

// LogLevel tells a logger the minimum level to log. When code reports a log entry,
// the LogLevel indicates the level of the log entry. The logger only records entries
// whose level is at least the level it was told to log. See the Log* constants.
// For example, if a logger is configured with LogError, then LogError, LogPanic,
// and LogFatal entries will be logged; lower level entries are ignored.
type LogLevel uint32

const (
	// LogNone tells a logger not to log any entries passed to it.
	LogNone LogLevel = iota

	// LogFatal tells a logger to log all LogFatal entries passed to it.
	LogFatal

	// LogPanic tells a logger to log all LogPanic and LogFatal entries passed to it.
	LogPanic

	// LogError tells a logger to log all LogError, LogPanic and LogFatal entries passed to it.
	LogError

	// LogWarning tells a logger to log all LogWarning, LogError, LogPanic and LogFatal entries passed to it.
	LogWarning

	// LogInfo tells a logger to log all LogInfo, LogWarning, LogError, LogPanic and LogFatal entries passed to it.
	LogInfo

	// LogDebug tells a logger to log all LogDebug, LogInfo, LogWarning, LogError, LogPanic and LogFatal entries passed to it.
	LogDebug
)

// LogOptions configures the pipeline's logging mechanism & level filtering.
type LogOptions struct {
	Log func(level LogLevel, message string)

	// ShouldLog is called periodically allowing you to return whether the specified LogLevel should be logged or not.
	// An application can return different values over the its lifetime; this allows the application to dynamically
	// alter what is logged. NOTE: This method can be called by multiple goroutines simultaneously so make sure
	// you implement it in a goroutine-safe way. If nil, nothing is logged (the equivalent of returning LogNone).
	// Usually, the function will be implemented simply like this: return level <= LogWarning
	ShouldLog func(level LogLevel) bool
}

type pipeline struct {
	factories []Factory
	options   Options
}

// The Pipeline interface represents an ordered list of Factory objects and an object implementing the HTTPSender interface.
// You construct a Pipeline by calling the pipeline.NewPipeline function. To send an HTTP request, call pipeline.NewRequest
// and then call Pipeline's Do method passing a context, the request, and a method-specific Factory (or nil). Passing a
// method-specific Factory allows this one call to Do to inject a Policy into the linked-list. The policy is injected where
// the MethodFactoryMarker (see the pipeline.MethodFactoryMarker function) is in the slice of Factory objects.
//
// When Do is called, the Pipeline object asks each Factory object to construct its Policy object and adds each Policy to a linked-list.
// THen, Do sends the Context and Request through all the Policy objects. The final Policy object sends the request over the network
// (via the HTTPSender object passed to NewPipeline) and the response is returned backwards through all the Policy objects.
// Since Pipeline and Factory objects are goroutine-safe, you typically create 1 Pipeline object and reuse it to make many HTTP requests.
type Pipeline interface {
	Do(ctx context.Context, methodFactory Factory, request Request) (Response, error)
}

// NewPipeline creates a new goroutine-safe Pipeline object from the slice of Factory objects and the specified options.
func NewPipeline(factories []Factory, o Options) Pipeline {
	if o.HTTPSender == nil {
		o.HTTPSender = newDefaultHTTPClientFactory()
	}
	if o.Log.Log == nil {
		o.Log.Log = func(LogLevel, string) {} // No-op logger
	}
	return &pipeline{factories: factories, options: o}
}

// Do is called for each and every HTTP request. It tells each Factory to create its own (mutable) Policy object
// replacing a MethodFactoryMarker factory (if it exists) with the methodFactory passed in. Then, the Context and Request
// are sent through the pipeline of Policy objects (which can transform the Request's URL/query parameters/headers) and
// ultimately sends the transformed HTTP request over the network.
func (p *pipeline) Do(ctx context.Context, methodFactory Factory, request Request) (Response, error) {
	response, err := p.newPolicies(methodFactory).Do(ctx, request)
	request.close()
	return response, err
}

func (p *pipeline) newPolicies(methodFactory Factory) Policy {
	// The last Policy is the one that actually sends the request over the wire and gets the response.
	// It is overridable via the Options' HTTPSender field.
	po := &PolicyOptions{pipeline: p} // One object shared by all policy objects
	next := p.options.HTTPSender.New(nil, po)

	// Walk over the slice of Factory objects in reverse (from wire to API)
	markers := 0
	for i := len(p.factories) - 1; i >= 0; i-- {
		factory := p.factories[i]
		if _, ok := factory.(methodFactoryMarker); ok {
			markers++
			if markers > 1 {
				panic("MethodFactoryMarker can only appear once in the pipeline")
			}
			if methodFactory != nil {
				// Replace MethodFactoryMarker with passed-in methodFactory
				next = methodFactory.New(next, po)
			}
		} else {
			// Use the slice's Factory to construct its Policy
			next = factory.New(next, po)
		}
	}

	// Each Factory has created its Policy
	if markers == 0 && methodFactory != nil {
		panic("Non-nil methodFactory requires MethodFactoryMarker in the pipeline")
	}
	return next // Return head of the Policy object linked-list
}

// A PolicyOptions represents optional information that can be used by a node in the
// linked-list of Policy objects. A PolicyOptions is passed to the Factory's New method
// which passes it (if desired) to the Policy object it creates. Today, the Policy object
// uses the options to perform logging. But, in the future, this could be used for more.
type PolicyOptions struct {
	pipeline *pipeline
}

// ShouldLog returns true if the specified log level should be logged.
func (po *PolicyOptions) ShouldLog(level LogLevel) bool {
	if po.pipeline.options.Log.ShouldLog != nil {
		return po.pipeline.options.Log.ShouldLog(level)
	}
	return false
}

// Log logs a string to the Pipeline's Logger.
func (po *PolicyOptions) Log(level LogLevel, msg string) {
	if !po.ShouldLog(level) {
		return // Short circuit message formatting if we're not logging it
	}

	// We are logging it, ensure trailing newline
	if len(msg) == 0 || msg[len(msg)-1] != '\n' {
		msg += "\n" // Ensure trailing newline
	}
	po.pipeline.options.Log.Log(level, msg)

	// If logger doesn't handle fatal/panic, we'll do it here.
	if level == LogFatal {
		os.Exit(1)
	} else if level == LogPanic {
		panic(msg)
	}
}

var pipelineHTTPClient = newDefaultHTTPClient()

func newDefaultHTTPClient() *http.Client {
	// We want the Transport to have a large connection pool
	return &http.Client{
		Transport: &http.Transport{
			Proxy: ieproxy.GetProxyFunc(),
			// We use Dial instead of DialContext as DialContext has been reported to cause slower performance.
			Dial /*Context*/ : (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
				DualStack: true,
			}).Dial, /*Context*/
			MaxIdleConns:           0, // No limit
			MaxIdleConnsPerHost:    100,
			IdleConnTimeout:        90 * time.Second,
			TLSHandshakeTimeout:    10 * time.Second,
			ExpectContinueTimeout:  1 * time.Second,
			DisableKeepAlives:      false,
			DisableCompression:     false,
			MaxResponseHeaderBytes: 0,
			//ResponseHeaderTimeout:  time.Duration{},
			//ExpectContinueTimeout:  time.Duration{},
		},
	}
}

// newDefaultHTTPClientFactory creates a DefaultHTTPClientPolicyFactory object that sends HTTP requests to a Go's default http.Client.
func newDefaultHTTPClientFactory() Factory {
	return FactoryFunc(func(next Policy, po *PolicyOptions) PolicyFunc {
		return func(ctx context.Context, request Request) (Response, error) {
			r, err := pipelineHTTPClient.Do(request.WithContext(ctx))
			if err != nil {
				err = NewError(err, "HTTP request failed")
			}
			return NewHTTPResponse(r), err
		}
	})
}

var mfm = methodFactoryMarker{} // Singleton

// MethodFactoryMarker returns a special marker Factory object. When Pipeline's Do method is called, any
// MethodMarkerFactory object is replaced with the specified methodFactory object. If nil is passed fro Do's
// methodFactory parameter, then the MethodFactoryMarker is ignored as the linked-list of Policy objects is created.
func MethodFactoryMarker() Factory {
	return mfm
}

type methodFactoryMarker struct {
}

func (methodFactoryMarker) New(next Policy, po *PolicyOptions) Policy {
	panic("methodFactoryMarker policy should have been replaced with a method policy")
}

// LogSanitizer can be implemented to clean secrets from lines logged by ForceLog
// By default no implemetation is provided here, because pipeline may be used in many different
// contexts, so the correct implementation is context-dependent
type LogSanitizer interface {
	SanitizeLogMessage(raw string) string
}

var sanitizer LogSanitizer
var enableForceLog bool = true

// SetLogSanitizer can be called to supply a custom LogSanitizer.
// There is no threadsafety or locking on the underlying variable,
// so call this function just once at startup of your application
// (Don't later try to change the sanitizer on the fly).
func SetLogSanitizer(s LogSanitizer)(){
	sanitizer = s
}

// SetForceLogEnabled can be used to disable ForceLog
// There is no threadsafety or locking on the underlying variable,
// so call this function just once at startup of your application
// (Don't later try to change the setting on the fly).
func SetForceLogEnabled(enable bool)() {
	enableForceLog = enable
}


