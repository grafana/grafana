package resource

import (
	"context"
	"io"
	"net/http"
	"net/url"
)

const NamespaceAll = ""

// Identifier is a unique-within-a-schema identifier, consisting of a Namespace and Name
type Identifier struct {
	Namespace string
	Name      string
}

// FullIdentifier is a globally-unique identifier, consisting of Schema identity information
// (Group, Version, Kind, Plural) and within-schema identity information (Namespace, Name)
type FullIdentifier struct {
	Namespace string
	Name      string
	Group     string
	Version   string
	Kind      string
	Plural    string
}

// CreateOptions are the options passed to a Client.Create call
type CreateOptions struct {
	// DryRun will perform a server-side dry-run of the request, if set to true.
	// The server will return the object that would be created, but will not actually create it.
	DryRun bool
}

// UpdateOptions are the options passed to a Client.Update call
type UpdateOptions struct {
	// ResourceVersion is the ResourceVersion to expect from the storage system when performing an update.
	// If there is a mismatch, the update will fail. To have the update succeed regardless of ResourceVersion,
	// leave this field empty.
	ResourceVersion string
	// Subresource can be set to a non-empty subresource field name to update that subresource,
	// instead of the main object
	Subresource string
	// DryRun will perform a server-side dry-run of the request, if set to true.
	// The server will return the object that would be created, but will not actually create it.
	DryRun bool
}

// ListOptions are the options passed to a Client.List call
type ListOptions struct {
	// ResourceVersion to list at
	ResourceVersion string
	// LabelFilters are a set of label filter strings to use when listing
	LabelFilters []string
	// FieldSelectors are a set of field selector strings to use when listing
	FieldSelectors []string
	// Limit limits the number of returned results from the List call, when >0.
	// The returned ListMetadata SHOULD include the remaining item count, and the page to use for the next call.
	Limit int
	// Continue is the page to continue from when listing. If non-empty, results will begin at the page token,
	// and return up to the Limit amount.
	Continue string
}

// PatchRequest represents a JSON patch request, which can contain multiple operations.
// Patch request operations are expected to adhere to the JSON Patch specification laid out by RFC6902,
// which can be found at https://www.rfc-editor.org/rfc/rfc6902
type PatchRequest struct {
	Operations []PatchOperation
}

// PatchOp represents an RFC6902 Patch "op" value
type PatchOp string

// RFC6902 PatchOp value
const (
	PatchOpAdd     = PatchOp("add")
	PatchOpRemove  = PatchOp("remove")
	PatchOpReplace = PatchOp("replace")
	PatchOpMove    = PatchOp("move")
	PatchOpCopy    = PatchOp("copy")
	PatchOpTest    = PatchOp("test")
)

// PatchOperation represents a single patch operation. The patch operation is a JSON Patch operation,
// as specified by RFC6902 (https://www.rfc-editor.org/rfc/rfc6902)
type PatchOperation struct {
	Path      string  `json:"path"`
	Operation PatchOp `json:"op"`
	Value     any     `json:"value,omitempty"`
}

// PatchOptions are the options passed to a Client.Patch call
type PatchOptions struct {
	// DryRun will perform a server-side dry-run of the request, if set to true.
	// The server will return the result of the patch, but will not actually apply it.
	DryRun bool
	// Subresource can be set to a non-empty subresource field name to update that subresource,
	// instead of the main object. It is not enough for a path in the patch request to use the subresource,
	// this field must also be set to the subresource explicitly, as they are considered
	// two distinct obejects for the purposes of mutation.
	// If the subresource has not been set in any prior request, it will be empty,
	// and a patch request should set the **entire object** (with the "/<subresource>" path),
	// rather than a component of the subresource, as a JSON patch cannot alter an absent object.
	Subresource string
}

type DeleteOptionsPropagationPolicy string

const (
	DeleteOptionsPropagationPolicyOrphan     DeleteOptionsPropagationPolicy = "Orphan"
	DeleteOptionsPropagationPolicyBackground DeleteOptionsPropagationPolicy = "Background"
	DeleteOptionsPropagationPolicyForeground DeleteOptionsPropagationPolicy = "Foreground"
	DeleteOptionsPropagationPolicyDefault    DeleteOptionsPropagationPolicy = ""
)

// DeleteOptions are the options passed to a Client.Delete call
type DeleteOptions struct {
	// Preconditions describes any conditions that must be true for the delete request to be processed
	Preconditions     DeleteOptionsPreconditions
	PropagationPolicy DeleteOptionsPropagationPolicy
}

type DeleteOptionsPreconditions struct {
	// ResourceVersion, if supplied, requires that the existing ResourceVersion in the API server must match for the delete request to be processed
	ResourceVersion string
	// UID, if supplied, requires that the existing UID in the API server must match for the delete request to be processed
	UID string
}

// WatchOptions are the options passed to a Client.Watch call
type WatchOptions struct {
	// ResourceVersion is the resource version to target with the call
	ResourceVersion string
	// ResourceVersionMatch is the way to match against the resource version
	ResourceVersionMatch string
	// EventBufferSize determines the size of the watch event buffer (typically implemented as the channel buffer size)
	// Only nonzero positive values are accepted, implementations will use the default value for cases where
	// EventBufferSize <= 0
	EventBufferSize int
	// LabelFilters are a set of label filter strings applied to watched resources
	LabelFilters []string
	// FieldSelectors are a set of field selector strings applied to watched resources
	FieldSelectors      []string
	AllowWatchBookmarks bool
	TimeoutSeconds      *int64
	// SendInitialEvents is used by streaming ListWatch
	SendInitialEvents *bool
}

// WatchResponse is an interface describing the response to a Client.Watch call
type WatchResponse interface {
	// Stop stops the watch request, and the channel returned by ResultChan
	Stop()
	// WatchEvents returns a channel that receives events from the watch request
	WatchEvents() <-chan WatchEvent
}

// WatchEvent is an event returned from a watch request
type WatchEvent struct {
	// EventType is the type of the event
	EventType string
	// Object is the affected object
	Object Object
}

// CustomRouteRequestOptions contains the options for a custom route request
type CustomRouteRequestOptions struct {
	// Path is the path of the custom route, from the base of the resource or namespace/api version
	Path string
	// Verb is the HTTP verb to use for the request
	Verb string
	// Body is the request body to supply. If nil, no body will be supplied in the request
	Body io.ReadCloser
	// Query is a set of UTL query parameters to supply in the request
	Query url.Values
	// Headers is the set of headers to pass in the request, in addition to any headers set by the client
	Headers http.Header
}

// Client is any object which interfaces with schema Objects.
// A single client should work on a per-Schema basis,
// where each instance of a client operates on a specific (group, version, kind).
// The implementation of the Client interface may re-use the same underlying communication client to the storage system,
// but the exposed Client should be created with a Schema in mind. For schema-agnostic Clients, use SchemalessClient.
type Client interface {
	// Get retrieves a resource with the given namespace and name
	Get(ctx context.Context, identifier Identifier) (Object, error)

	// GetInto retrieves a resource with the given namespace and name, and unmarshals it into `into`
	GetInto(ctx context.Context, identifier Identifier, into Object) error

	// Create creates a new resource, returning the created resource from the storage layer
	Create(ctx context.Context, identifier Identifier, obj Object, options CreateOptions) (Object, error)

	// CreateInto creates a new resource, and unmarshals the storage response (the created object) into the `into` field
	CreateInto(ctx context.Context, identifier Identifier, obj Object, options CreateOptions, into Object) error

	// Update updates a resource
	Update(ctx context.Context, identifier Identifier, obj Object, options UpdateOptions) (Object, error)

	// UpdateInto updates a response, and marshals the updated version into the `into` field
	UpdateInto(ctx context.Context, identifier Identifier, obj Object, options UpdateOptions, into Object) error

	// Patch performs a JSON Patch on an object, using the content of the PatchRequest
	Patch(ctx context.Context, identifier Identifier, patch PatchRequest, options PatchOptions) (Object, error)

	// PatchInto performs a JSON Patch on an object, using the content of the PatchRequest,
	// marshaling the returned (full) object into `into`
	PatchInto(ctx context.Context, identifier Identifier, patch PatchRequest, options PatchOptions, into Object) error

	// Delete deletes an exiting resource
	Delete(ctx context.Context, identifier Identifier, options DeleteOptions) error

	// List lists objects based on the options criteria.
	// For resources with a schema.Scope() of ClusterScope, `namespace` must be resource.NamespaceAll
	List(ctx context.Context, namespace string, options ListOptions) (ListObject, error)

	// ListInto lists objects based on the options criteria, and marshals the list response into the `into` field.
	// For resources with a schema.Scope() of ClusterScope, `namespace` must be resource.NamespaceAll.
	ListInto(ctx context.Context, namespace string, options ListOptions, into ListObject) error

	// Watch makes a watch request to the provided namespace, and returns an object which implements WatchResponse
	Watch(ctx context.Context, namespace string, options WatchOptions) (WatchResponse, error)

	// SubresourceRequest makes a request to a resource's subresource path using the provided verb.
	// It returns the raw bytes of the response, or an error if the request returns an error.
	SubresourceRequest(ctx context.Context, identifier Identifier, req CustomRouteRequestOptions) ([]byte, error)
}

// SchemalessClient is a Schema-agnostic version of the Client interface.
// All methods require an `into` field, as the Client has no schema knowledge so must do blind deserialization
// without the benefit of a Schema.ZeroValue(). Passed identifiers are now FullIdentifier, which includes
// group, version, and kind schema information.
// Reading/Writing of objects to wire format is left to the discretion of the implementer.
type SchemalessClient interface {
	// Get retrieves a resource identified by identifier, and marshals it into `into`
	Get(ctx context.Context, identifier FullIdentifier, into Object) error

	// Create creates a new resource, and marshals the storage response (the created object) into the `into` field
	Create(ctx context.Context, identifier FullIdentifier, obj Object, options CreateOptions, into Object) error

	// Update updates an existing resource, and marshals the updated version into the `into` field
	Update(ctx context.Context, identifier FullIdentifier, obj Object, options UpdateOptions, into Object) error

	// Patch performs a JSON Patch on an object, using the content of the PatchRequest,
	// marshaling the returned (full) object into `into`
	Patch(ctx context.Context, identifier FullIdentifier, path PatchRequest, options PatchOptions, into Object) error

	// Delete deletes a resource identified by identifier
	Delete(ctx context.Context, identifier FullIdentifier, options DeleteOptions) error

	// List lists all resources that satisfy identifier, ignoring `Name`. The response is marshaled into `into`.
	// `exampleListItem` must be provided for proper type unmarshaling, and should be the same kind of object
	// that would be passed to a Get call for `into`
	List(ctx context.Context, identifier FullIdentifier, options ListOptions, into ListObject, exampleListItem Object) error

	// Watch watches all resources that satisfy the identifier, ignoring `Name`.
	// The WatchResponse's WatchEvent Objects are created by unmarshaling into an object created by calling
	// example.Copy().
	Watch(ctx context.Context, identifier FullIdentifier, options WatchOptions, example Object) (WatchResponse, error)
}

// ClientGenerator is used for creating clients to interface with given schemas
type ClientGenerator interface {
	// ClientFor returns a Client for the provided Schema. This returned Client is not guaranteed to be unique,
	// and can be shared by other ClientFor calls.
	ClientFor(Kind) (Client, error)
}
