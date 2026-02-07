package k8s

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
)

var (
	_ resource.SchemalessClient = &SchemalessClient{}
)

// SchemalessClient implements resource.SchemalessClient and allows for working with Schemas as kubernetes
// Custom Resource Definitions without being tied to a particular Schema (or GroupVerson).
// Since the largest unit a kubernetes rest.Interface can work with is a GroupVersion,
// SchemalessClient is actually an arbitrary number of kubernetes REST clients under-the-hood.
type SchemalessClient struct {
	// config REST config used to generate new clients
	kubeConfig rest.Config

	clientConfig ClientConfig

	// codec is used for encoding/decoding JSON bytes into objects
	codec resource.Codec

	// clients is the actual k8s clients, groupversion -> client
	clients map[string]*groupVersionClient

	mutex sync.Mutex

	// prometheus collectors for the client
	requestDurations *prometheus.HistogramVec
	totalRequests    *prometheus.CounterVec
	watchEventsTotal *prometheus.CounterVec
	watchErrorsTotal *prometheus.CounterVec
}

// NewSchemalessClient creates a new SchemalessClient using the provided rest.Config and ClientConfig.
func NewSchemalessClient(kubeConfig rest.Config, clientConfig ClientConfig) *SchemalessClient {
	return NewSchemalessClientWithCodec(kubeConfig, clientConfig, resource.NewJSONCodec())
}

func NewSchemalessClientWithCodec(kubeConfig rest.Config, clientConfig ClientConfig, jsonCodec resource.Codec) *SchemalessClient {
	kubeConfig.NegotiatedSerializer = &GenericNegotiatedSerializer{}
	kubeConfig.UserAgent = rest.DefaultKubernetesUserAgent()
	return &SchemalessClient{
		kubeConfig:   kubeConfig,
		clientConfig: clientConfig,
		codec:        jsonCodec,
		clients:      make(map[string]*groupVersionClient),
		requestDurations: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       clientConfig.MetricsConfig.Namespace,
			Subsystem:                       "kubernetes_client",
			Name:                            "request_duration_seconds",
			Help:                            "Time (in seconds) spent serving HTTP requests.",
			Buckets:                         metrics.LatencyBuckets,
			NativeHistogramBucketFactor:     clientConfig.MetricsConfig.NativeHistogramBucketFactor,
			NativeHistogramMaxBucketNumber:  clientConfig.MetricsConfig.NativeHistogramMaxBucketNumber,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"status_code", "verb", "kind", "subresource"}),
		totalRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name:      "requests_total",
			Subsystem: "kubernetes_client",
			Namespace: clientConfig.MetricsConfig.Namespace,
			Help:      "Total number of kubernetes requests",
		}, []string{"status_code", "verb", "kind", "subresource"}),
		watchEventsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name:      "watch_events_total",
			Subsystem: "kubernetes_client",
			Namespace: clientConfig.MetricsConfig.Namespace,
			Help:      "Total number of watch events received by type",
		}, []string{"event_type", "kind"}),
		watchErrorsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name:      "watch_errors_total",
			Subsystem: "kubernetes_client",
			Namespace: clientConfig.MetricsConfig.Namespace,
			Help:      "Total number of watch event parsing/translation errors",
		}, []string{"error_type", "kind"}),
	}
}

// Get gets a resource from kubernetes with the Kind and GroupVersion determined from the FullIdentifier,
// using the namespace and name in FullIdentifier. If identifier.Plural is present, it will use that,
// otherwise, LOWER(identifier.Kind) + s is used for the resource.
// The returned resource is marshaled into `into`.
func (s *SchemalessClient) Get(ctx context.Context, identifier resource.FullIdentifier, into resource.Object) error {
	if into == nil {
		return errors.New("into cannot be nil")
	}
	client, err := s.getClient(identifier)
	if err != nil {
		return err
	}
	return client.get(ctx, resource.Identifier{
		Namespace: identifier.Namespace,
		Name:      identifier.Name,
	}, s.getPlural(identifier), into, s.codec)
}

// Create creates a new resource, and marshals the storage response (the created object) into the `into` field.
func (s *SchemalessClient) Create(
	ctx context.Context, id resource.FullIdentifier, obj resource.Object, opt resource.CreateOptions, out resource.Object,
) error {
	if obj == nil {
		return errors.New("obj cannot be nil")
	}
	if out == nil {
		return errors.New("into cannot be nil")
	}
	client, err := s.getClient(id)
	if err != nil {
		return err
	}

	obj.SetStaticMetadata(resource.StaticMetadata{
		Namespace: id.Namespace,
		Name:      id.Name,
		Group:     id.Group,
		Version:   id.Version,
		Kind:      id.Kind,
	})

	return client.create(ctx, s.getPlural(id), obj, out, opt, s.codec)
}

// Update updates an existing resource, and marshals the updated version into the `into` field
func (s *SchemalessClient) Update(ctx context.Context, identifier resource.FullIdentifier, obj resource.Object,
	options resource.UpdateOptions, into resource.Object) error {
	if obj == nil {
		return errors.New("obj cannot be nil")
	}
	if into == nil {
		return errors.New("into cannot be nil")
	}
	client, err := s.getClient(identifier)
	if err != nil {
		return err
	}

	obj.SetStaticMetadata(resource.StaticMetadata{
		Namespace: identifier.Namespace,
		Name:      identifier.Name,
		Group:     identifier.Group,
		Version:   identifier.Version,
		Kind:      identifier.Kind,
	})
	if options.ResourceVersion == "" {
		existingMd, err := client.getMetadata(ctx, resource.Identifier{
			Namespace: identifier.Namespace,
			Name:      identifier.Name,
		}, s.getPlural(identifier))
		if err != nil {
			return err
		}

		obj.SetResourceVersion(existingMd.GetResourceVersion())
	} else {
		obj.SetResourceVersion(options.ResourceVersion)
	}

	if options.Subresource != "" {
		return client.updateSubresource(ctx, s.getPlural(identifier), options.Subresource, obj, into, options, s.codec)
	}
	return client.update(ctx, s.getPlural(identifier), obj, into, options, s.codec)
}

// Patch performs a JSON Patch on the provided resource, and marshals the updated version into the `into` field
func (s *SchemalessClient) Patch(ctx context.Context, identifier resource.FullIdentifier, patch resource.PatchRequest,
	options resource.PatchOptions, into resource.Object) error {
	client, err := s.getClient(identifier)
	if err != nil {
		return err
	}

	return client.patch(ctx, resource.Identifier{
		Namespace: identifier.Namespace,
		Name:      identifier.Name,
	}, s.getPlural(identifier), patch, into, options, s.codec)
}

// Delete deletes a resource identified by identifier
func (s *SchemalessClient) Delete(ctx context.Context, identifier resource.FullIdentifier, options resource.DeleteOptions) error {
	client, err := s.getClient(identifier)
	if err != nil {
		return err
	}

	return client.delete(ctx, resource.Identifier{
		Namespace: identifier.Namespace,
		Name:      identifier.Name,
	}, s.getPlural(identifier), options)
}

// List lists all resources that satisfy identifier, ignoring `Name`. The response is marshaled into `into`
func (s *SchemalessClient) List(ctx context.Context, identifier resource.FullIdentifier,
	options resource.ListOptions, into resource.ListObject, exampleListItem resource.Object) error {
	if into == nil {
		return errors.New("into cannot be nil")
	}
	client, err := s.getClient(identifier)
	if err != nil {
		return err
	}

	return client.list(ctx, identifier.Namespace, s.getPlural(identifier), into, options,
		func(raw []byte) (resource.Object, error) {
			into := exampleListItem.Copy()
			err := s.codec.Read(bytes.NewReader(raw), into)
			return into, err
		})
}

// Watch watches all resources that satisfy the identifier, ignoring `Name`.
// The WatchResponse's WatchEvent Objects are created by unmarshaling into an object created by calling
// example.Copy().
func (s *SchemalessClient) Watch(ctx context.Context, identifier resource.FullIdentifier, options resource.WatchOptions,
	exampleObject resource.Object) (resource.WatchResponse, error) {
	if exampleObject == nil {
		return nil, errors.New("exampleItem cannot be nil")
	}
	client, err := s.getClient(identifier)
	if err != nil {
		return nil, err
	}
	return client.watch(ctx, identifier.Namespace, s.getPlural(identifier), exampleObject, options, s.codec)
}

// PrometheusCollectors returns the prometheus metric collectors used by this client to allow for registration
func (s *SchemalessClient) PrometheusCollectors() []prometheus.Collector {
	return []prometheus.Collector{
		s.totalRequests, s.requestDurations, s.watchEventsTotal, s.watchErrorsTotal,
	}
}

func (s *SchemalessClient) getClient(identifier resource.FullIdentifier) (*groupVersionClient, error) {
	gv := schema.GroupVersion{
		Group:   identifier.Group,
		Version: identifier.Version,
	}
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if c, ok := s.clients[gv.Identifier()]; ok {
		return c, nil
	}

	s.kubeConfig.GroupVersion = &gv
	client, err := rest.RESTClientFor(&s.kubeConfig)
	if err != nil {
		return nil, err
	}
	s.clients[gv.Identifier()] = &groupVersionClient{
		client:           client,
		version:          identifier.Version,
		config:           s.clientConfig,
		requestDurations: s.requestDurations,
		totalRequests:    s.totalRequests,
		watchEventsTotal: s.watchEventsTotal,
		watchErrorsTotal: s.watchErrorsTotal,
	}
	return s.clients[gv.Identifier()], nil
}

//nolint:revive
func (s *SchemalessClient) getPlural(identifier resource.FullIdentifier) string {
	if identifier.Plural != "" {
		return identifier.Plural
	}
	return fmt.Sprintf("%ss", strings.ToLower(identifier.Kind))
}
