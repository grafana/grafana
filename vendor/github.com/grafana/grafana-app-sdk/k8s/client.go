package k8s

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
)

var (
	_ resource.Client = &Client{}
)

// Client is a kubernetes-specific implementation of resource.Client, using custom resource definitions.
// A Client is specific to the Schema it was created with.
// New Clients should only be created via the ClientRegistry.ClientFor method.
type Client struct {
	client *groupVersionClient
	schema resource.Schema
	codec  resource.Codec
	config ClientConfig
}

// ClientConfig is the configuration object for creating Clients.
type ClientConfig struct {
	// CustomMetadataIsAnyType tells the Client if the custom metadata of an object can be of any type, or is limited to only strings.
	// By default, this is false, with which the client will assume custom metadata is only a string type,
	// and not invoke reflection to turn the type into a string when encoding to the underlying kubernetes annotation storage.
	// If set to true, the client will use reflection to get the type of each custom metadata field,
	// and convert it into a string (structs and lists will be converted into stringified JSON).
	// Keep in mind that the metadata bytes blob used in unmarshaling will always have custom metadata as string types,
	// regardless of how this value is set, so make sure your resource.Object implementations can handle
	// turning strings into non-string types when unmarshaling if you plan to have custom metadata keys which have non-string values.
	CustomMetadataIsAnyType bool

	MetricsConfig metrics.Config

	// NegotiatedSerializerProvider is a function which provides a runtime.NegotiatedSerializer for the underlying
	// kubernetes rest.RESTClient, if defined.
	NegotiatedSerializerProvider func(kind resource.Kind) runtime.NegotiatedSerializer

	// KubeConfigProvider can be used to provide an altered or alternative rest.Config based on kind.
	// It is passed the Kind and existing rest.Config, and should return a valid rest.Config
	// (returning the same rest.Config as the input is valid)
	KubeConfigProvider func(kind resource.Kind, kubeConfig rest.Config) rest.Config

	// EnableStreamErrorHandling wraps the HTTP transport to handle transient gRPC stream errors gracefully.
	// When enabled, errors like "stream error:", "INTERNAL_ERROR", "connection reset", and "broken pipe"
	// are converted to connection-like errors that trigger automatic reconnection rather than failing
	// the watch permanently. This improves resilience of Kubernetes watch connections during transient
	// network issues or server-side errors.
	// Default: true (enabled for better reliability)
	EnableStreamErrorHandling bool
}

// DefaultClientConfig returns a ClientConfig using defaults that assume you have used the SDK codegen tooling
func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		CustomMetadataIsAnyType:   false,
		MetricsConfig:             metrics.DefaultConfig(""),
		EnableStreamErrorHandling: true,
		KubeConfigProvider: func(kind resource.Kind, kubeConfig rest.Config) rest.Config {
			if kubeConfig.APIPath != "" {
				return kubeConfig // Don't modify the kubeConfig if the APIPath is already configured
			}
			// If it isn't configured, set the APIPath based on the kind's group
			if kind.Group() == "" {
				kubeConfig.APIPath = "/api"
			} else {
				kubeConfig.APIPath = "/apis"
			}
			return kubeConfig
		},
		/* NegotiatedSerializerProvider: func(kind resource.Kind) runtime.NegotiatedSerializer {
			return &KindNegotiatedSerializer{
				Kind: kind,
			}
		},*/
	}
}

// NewClientWithRESTInterface creates a Client with a custom rest.Interface.
// This is primarily useful for testing with mock HTTP transports.
// For production use, prefer using ClientRegistry.ClientFor() instead.
func NewClientWithRESTInterface(
	restClient rest.Interface,
	kind resource.Kind,
	config ClientConfig,
) (*Client, error) {
	codec := kind.Codec(resource.KindEncodingJSON)
	if codec == nil {
		return nil, errors.New("no codec for KindEncodingJSON")
	}

	return &Client{
		client: &groupVersionClient{
			client:  restClient,
			version: kind.Version(),
			config:  config,
			// Metrics fields can be nil for testing/benchmarks
			requestDurations: nil,
			totalRequests:    nil,
			watchEventsTotal: nil,
			watchErrorsTotal: nil,
		},
		schema: kind,
		codec:  codec,
		config: config,
	}, nil
}

// List lists resources in the provided namespace.
// For resources with a schema.Scope() of ClusterScope, `namespace` must be resource.NamespaceAll
func (c *Client) List(ctx context.Context, namespace string, options resource.ListOptions) (
	resource.ListObject, error) {
	into := c.schema.ZeroListValue()
	err := c.client.list(ctx, namespace, c.schema.Plural(), into, options, func(raw []byte) (resource.Object, error) {
		into := c.schema.ZeroValue()
		err := c.codec.Read(bytes.NewReader(raw), into)
		return into, err
	})
	if err != nil {
		return nil, err
	}
	return into, err
}

// ListInto lists resources in the provided namespace, and unmarshals the response into the provided resource.ListObject
func (c *Client) ListInto(ctx context.Context, namespace string, options resource.ListOptions,
	into resource.ListObject) error {
	if c.schema.Scope() == resource.ClusterScope && namespace != resource.NamespaceAll {
		return fmt.Errorf("cannot list resources with schema scope \"%s\" in namespace \"%s\", must be NamespaceAll (\"%s\")",
			resource.ClusterScope, namespace, resource.NamespaceAll)
	}
	return c.client.list(ctx, namespace, c.schema.Plural(), into, options,
		func(raw []byte) (resource.Object, error) {
			into := c.schema.ZeroValue()
			err := c.codec.Read(bytes.NewReader(raw), into)
			return into, err
		})
}

// Get gets a resource of the client's internal Schema-derived kind, with the provided identifier
func (c *Client) Get(ctx context.Context, identifier resource.Identifier) (resource.Object, error) {
	into := c.schema.ZeroValue()
	err := c.GetInto(ctx, identifier, into)
	if err != nil {
		return nil, err
	}
	return into, nil
}

// GetInto gets a resource of the client's internal Schema-derived kind, with the provided identifier,
// and marshals it into `into`
func (c *Client) GetInto(ctx context.Context, identifier resource.Identifier, into resource.Object) error {
	if into == nil {
		return errors.New("into cannot be nil")
	}
	return c.client.get(ctx, identifier, c.schema.Plural(), into, c.codec)
}

// Create creates a new resource, and returns the resulting created resource
func (c *Client) Create(
	ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions,
) (resource.Object, error) {
	into := c.schema.ZeroValue()
	if err := c.CreateInto(ctx, id, obj, opts, into); err != nil {
		return nil, err
	}
	return into, nil
}

// CreateInto creates a new resource, and marshals the resulting created resource into `into`
func (c *Client) CreateInto(
	ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions, into resource.Object,
) error {
	if obj == nil {
		return errors.New("obj cannot be nil")
	}
	if into == nil {
		return errors.New("into cannot be nil")
	}
	if c.schema.Scope() == resource.NamespacedScope && id.Namespace == resource.NamespaceAll {
		return fmt.Errorf(
			"cannot create a resource with schema scope \"%s\" in NamespaceAll (\"%s\")",
			resource.NamespacedScope, resource.NamespaceAll,
		)
	} else if c.schema.Scope() == resource.ClusterScope && id.Namespace != resource.NamespaceAll {
		return fmt.Errorf(
			"cannot create a resource with schema scope \"%s\" in namespace \"%s\", must be NamespaceAll (\"%s\")",
			resource.ClusterScope, id.Namespace, resource.NamespaceAll,
		)
	}
	// Check if we need to add metadata to the object
	obj.SetStaticMetadata(resource.StaticMetadata{
		Namespace: id.Namespace,
		Name:      id.Name,
		Group:     c.schema.Group(),
		Version:   c.schema.Version(),
		Kind:      c.schema.Kind(),
	})

	return c.client.create(ctx, c.schema.Plural(), obj, into, opts, c.codec)
}

// Update updates the provided resource, and returns the updated resource from kubernetes
func (c *Client) Update(ctx context.Context, identifier resource.Identifier, obj resource.Object,
	options resource.UpdateOptions) (resource.Object, error) {
	if obj == nil {
		return nil, errors.New("obj cannot be nil")
	}
	into := c.schema.ZeroValue()
	err := c.UpdateInto(ctx, identifier, obj, options, into)
	if err != nil {
		return nil, err
	}
	return into, nil
}

// UpdateInto updates the provided resource, and marshals the updated resource from kubernetes into `into`
func (c *Client) UpdateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object,
	options resource.UpdateOptions, into resource.Object) error {
	if obj == nil {
		return errors.New("obj cannot be nil")
	}
	if into == nil {
		return errors.New("into cannot be nil")
	}
	obj.SetStaticMetadata(resource.StaticMetadata{
		Namespace: identifier.Namespace,
		Name:      identifier.Name,
		Group:     c.schema.Group(),
		Version:   c.schema.Version(),
		Kind:      c.schema.Kind(),
	})

	if options.ResourceVersion == "" {
		existingMd, err := c.client.getMetadata(ctx, identifier, c.schema.Plural())
		if err != nil {
			return err
		}

		obj.SetResourceVersion(existingMd.ResourceVersion)
	} else {
		obj.SetResourceVersion(options.ResourceVersion)
	}

	if options.Subresource != "" {
		return c.client.updateSubresource(ctx, c.schema.Plural(), options.Subresource, obj, into, options, c.codec)
	}
	return c.client.update(ctx, c.schema.Plural(), obj, into, options, c.codec)
}

// Patch performs a JSON Patch on the provided resource, and returns the updated object
func (c *Client) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest,
	options resource.PatchOptions) (resource.Object, error) {
	into := c.schema.ZeroValue()
	err := c.PatchInto(ctx, identifier, patch, options, into)
	if err != nil {
		return nil, err
	}
	return into, nil
}

// PatchInto performs a JSON Patch on the provided resource, and marshals the updated version into the `into` field
func (c *Client) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest,
	options resource.PatchOptions, into resource.Object) error {
	return c.client.patch(ctx, identifier, c.schema.Plural(), patch, into, options, c.codec)
}

// Delete deletes the specified resource
func (c *Client) Delete(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
	return c.client.delete(ctx, identifier, c.schema.Plural(), options)
}

// Watch makes a watch request for the namespace, and returns a WatchResponse which wraps a kubernetes
// watch.Interface. The underlying watch.Interface can be accessed using KubernetesWatch()
func (c *Client) Watch(ctx context.Context, namespace string, options resource.WatchOptions) (
	resource.WatchResponse, error) {
	if c.schema.Scope() == resource.ClusterScope && namespace != resource.NamespaceAll {
		return nil, fmt.Errorf("cannot watch resources with schema scope \"%s\" in namespace \"%s\", must be NamespaceAll (\"%s\")",
			resource.ClusterScope, namespace, resource.NamespaceAll)
	}
	return c.client.watch(ctx, namespace, c.schema.Plural(), c.schema.ZeroValue(), options, c.codec)
}

// SubresourceRequest makes a request to an arbitrary subresource of the object identified by identifier.
// Verb and Path should be included in the options.
func (c *Client) SubresourceRequest(ctx context.Context, identifier resource.Identifier, opts resource.CustomRouteRequestOptions) ([]byte, error) {
	if c.schema.Scope() == resource.ClusterScope && identifier.Namespace != resource.NamespaceAll {
		return nil, fmt.Errorf("cannot watch resources with schema scope \"%s\" in namespace \"%s\", must be NamespaceAll (\"%s\")",
			resource.ClusterScope, identifier.Namespace, resource.NamespaceAll)
	}
	if opts.Path == "" {
		return nil, errors.New("subresource Path is required")
	}
	if opts.Verb == "" {
		return nil, errors.New("request Verb is required")
	}
	return c.client.customRouteRequest(ctx, identifier.Namespace, c.schema.Plural(), identifier.Name, opts)
}

// Metrics returns the prometheus collectors used by this Client for registration with a prometheus exporter
func (c *Client) PrometheusCollectors() []prometheus.Collector {
	return c.client.metrics()
}

// RESTClient returns the underlying rest.Interface used to communicate with kubernetes
func (c *Client) RESTClient() rest.Interface {
	return c.client.client
}
