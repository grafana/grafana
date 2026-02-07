package app

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/health"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
)

var (
	// ErrNotImplemented is an error that indicates that an App method is not implemented by the App implementation,
	// or the App method is not implemented for the provided Kind.
	// Typically, the App's ManifestData should indicate this as well.
	ErrNotImplemented = errors.New("not implemented")

	ErrCustomRouteNotFound = errors.New("custom route not found")
)

// ConversionRequest is a request to convert a Kind from one version to another
type ConversionRequest struct {
	SourceGVK schema.GroupVersionKind
	TargetGVK schema.GroupVersionKind
	Raw       RawObject
}

// RawObject represents the raw bytes of the object and its encoding, optionally with a decoded version of the object,
// which may be any valid resource.Object implementation.
type RawObject struct {
	Raw      []byte                `json:",inline"`
	Object   resource.Object       `json:"-"`
	Encoding resource.KindEncoding `json:"-"`
}

// CustomRouteRequest is a request to a custom subresource or resource route
type CustomRouteRequest struct {
	// ResourceIdentifier is the full identifier of the resource.
	// If the request is not a subresource route request, ResourceIdentifier will contain only group,
	// version, and namespace (if applicable).
	// ResourceIdentifier will contain all information the runner is able to provide.
	// In practical terms, this often means that either Kind or Plural will be included, but both may not be present.
	// For a non-subresource route, only Group, Version, and optionally Namespace (for namespaced routes) will be included.
	ResourceIdentifier resource.FullIdentifier
	// Path contains path information past the identifier information.
	// For a subresource route, this is the subresource (for example, `bar` in the case of `test.grafana.app/v1/foos/foo/bar`).
	// In the case of a non-subresource route, this will be the path section past the namespace (or version if the route is not namespaced).
	Path string
	// URL is the full URL object of the request, which can be used to extract query parameters, or host/protocol for redirects
	URL *url.URL
	// Method is the HTTP request method
	Method string
	// Headers contains the HTTP headers of the original request. Runners MAY remove or sanitize some headers.
	Headers http.Header
	// Body contains the payload of the request. Body may contain incomplete data if the request is streamed and not yet complete.
	// Body data is considered complete once a call to Read results in zero bytes read and an error such as io.EOF
	// (see godoc for io.Reader). A consumer SHOULD call Body.Close() when they are finished consuming the body,
	// especially in the case of incomplete data, to signal to the runner that the handler has finished consuming the payload.
	Body io.ReadCloser
}

// CustomRouteResponseWriter is a ResponseWriter for CustomRouteResponse objects. It mirrors http.ResponseWriter,
// but exact implementation is runner-dependent.
type CustomRouteResponseWriter interface {
	http.ResponseWriter
}

// Config is the app configuration used in a Provider for instantiating a new App.
// It contains kubernetes configuration for communicating with an API server, the App's ManifestData as fetched
// by the runner, and additional arbitrary configuration details that may be app-specific.
type Config struct {
	// KubeConfig is a kubernetes rest.Config used to communicate with the API server where the App's Kinds are stored.
	KubeConfig rest.Config
	// ManifestData is the fetched ManifestData the runner is using for determining app kinds and capabilities.
	ManifestData ManifestData
	// SpecificConfig is app-specific config (as opposed to generic config)
	SpecificConfig SpecificConfig
}

// SpecificConfig is app-specific configuration which can vary from app to app
// TODO: better type than any
type SpecificConfig any

// Provider represents a type which can provide an app manifest, and create a new App when given a configuration.
// It should be used by runners to determine an app's capabilities and create an instance of the app to run.
type Provider interface {
	// Manifest returns a Manifest, which may contain ManifestData or may point to a location where ManifestData can be fetched from.
	// The runner should use the ManifestData to determine app capabilities.
	Manifest() Manifest
	// SpecificConfig is any app-specific config that cannot be loaded by the runner that should be provided in NewApp
	SpecificConfig() SpecificConfig
	// NewApp creates a new App instance using the provided config, or returns an error if an App cannot be instantiated.
	NewApp(Config) (App, error)
}

// Runnable represents a type which can be run until it errors or the provided channel is stopped (or receives a message)
type Runnable interface {
	// Run runs the process and blocks until one of the following conditions are met:
	// * An unrecoverable error occurs, in which case it returns the error
	// * The provided context completes
	// * The process completes and does not need to run again
	Run(context.Context) error
}

type AdmissionRequest resource.AdmissionRequest
type MutatingResponse resource.MutatingResponse

// App represents an app platform application logical structure.
// An App is typically run with a wrapper, such as simple.NewStandaloneOperator,
// which will present a runtime layer (such as kubernetes webhooks in the case of an operator),
// and translate those into calls to the App. The wrapper is typically also responsible for lifecycle management
// and running the Runnable provided by Runner().
// Pre-built implementations of App exist in the simple package, but any type which implements App
// should be capable of being run by an app wrapper.
type App interface {
	metrics.Provider
	health.Checker
	// Validate validates the incoming request, and returns an error if validation fails
	Validate(ctx context.Context, request *AdmissionRequest) error
	// Mutate runs mutation on the incoming request, responding with a MutatingResponse on success, or an error on failure
	Mutate(ctx context.Context, request *AdmissionRequest) (*MutatingResponse, error)
	// Convert converts the object based on the ConversionRequest, returning a RawObject which MUST contain
	// the converted bytes and encoding (Raw and Encoding respectively), and MAY contain the Object representation of those bytes.
	// It returns an error if the conversion fails, or if the functionality is not supported by the app.
	Convert(ctx context.Context, req ConversionRequest) (*RawObject, error)
	// CallCustomRoute handles the call to a custom route, and the caller provides a CustomRouteResponseWriter for the App
	// to write the status code and response object(s) to.
	// If the route doesn't exist, the implementer MAY return ErrCustomRouteNotFound to signal to the runner,
	// or may choose to write a not found status code and custom body.
	// It returns an error if the functionality is not supported by the app.
	CallCustomRoute(ctx context.Context, responseWriter CustomRouteResponseWriter, request *CustomRouteRequest) error
	// ManagedKinds returns a slice of Kinds which are managed by this App.
	// If there are multiple versions of a Kind, each one SHOULD be returned by this method,
	// as app runners may depend on having access to all kinds.
	ManagedKinds() []resource.Kind
	// Runner returns a Runnable with an app main loop. Any business logic that is not/can not be exposed
	// via other App interfaces should be contained within this method.
	// Runnable MAY be nil, in which case, the app has no main loop business logic.
	Runner() Runnable
}
