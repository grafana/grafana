package types

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNamespaceMismatch      = errors.New("namespace mismatch")
	ErrMissingRequestGroup    = errors.New("missing request group")
	ErrMissingRequestResource = errors.New("missing request resource")
	ErrMissingRequestVerb     = errors.New("missing request verb")

	// BatchCheck validation errors
	ErrTooManyChecks          = errors.New("too many checks in batch request, maximum is 50")
	ErrEmptyCorrelationID     = errors.New("correlation ID cannot be empty")
	ErrDuplicateCorrelationID = errors.New("duplicate correlation ID in batch request")
)

// MaxBatchCheckItems is the maximum number of checks allowed in a single BatchCheckRequest
const MaxBatchCheckItems = 50

// CheckRequest describes the requested access.
// This is designed bo to play nicely with the kubernetes authorization system:
// https://github.com/kubernetes/kubernetes/blob/v1.30.3/staging/src/k8s.io/apiserver/pkg/authorization/authorizer/interfaces.go#L28
type CheckRequest struct {
	// The requested access verb.
	// this includes get, list, watch, create, update, patch, delete, deletecollection, and proxy,
	// or the lowercased HTTP verb associated with non-API requests (this includes get, put, post, patch, and delete)
	Verb string

	// API group (dashboards.grafana.app)
	Group string

	// ~Kind eg dashboards
	Resource string

	// tenant isolation
	Namespace string

	// The specific resource
	// In grafana, this was historically called "UID", but in k8s, it is the name
	Name string

	// Optional subresource
	Subresource string

	// For non-resource requests, this will be the requested URL path
	Path string

	// SkipCache forces the access checker to skip any caching layer
	SkipCache bool
}

type CheckResponse struct {
	// Allowed is true if the request is allowed, false otherwise.
	Allowed bool
	// Zookie tracks the freshness of the authorization decision.
	Zookie Zookie
}

type Zookie interface {
	IsFresherThan(d time.Time) bool
}

type AccessChecker interface {
	// Check checks whether the user can perform the given action for all requests
	// NOTE, the authz system does not know the folder where each resource is stored
	// the folder must be passed into the system when folder authorization is required
	Check(ctx context.Context, info AuthInfo, req CheckRequest, folder string) (CheckResponse, error)
}

type ListRequest struct {
	// API group (dashboards.grafana.app)
	Group string

	// ~Kind eg dashboards
	Resource string

	// tenant isolation
	Namespace string

	// Verb is the requested access verb.
	Verb string

	// Optional subresource
	Subresource string

	// SkipCache forces the access checker to skip any caching layer
	SkipCache bool
}

// BatchCheckItem represents a single check in a batch request.
// Each item must have a unique CorrelationID to match with its result.
type BatchCheckItem struct {
	// CorrelationID is a unique identifier to correlate this check with its result.
	// Must be a non-empty string unique within the batch request.
	CorrelationID string

	// The requested access verb.
	Verb string

	// API group (dashboards.grafana.app)
	Group string

	// ~Kind eg dashboards
	Resource string

	// The specific resource name
	Name string

	// Optional subresource
	Subresource string

	// For non-resource requests, this will be the requested URL path
	Path string

	// Folder is the parent folder of the resource
	Folder string

	// FreshnessTimestamp is the timestamp when the resource was last modified.
	// If provided, the server should skip cache for this item if the cached result
	// is older than this timestamp. This ensures freshness for recently modified resources.
	FreshnessTimestamp time.Time
}

// BatchCheckRequest contains multiple checks to be performed at once.
// Maximum of 50 checks per request.
type BatchCheckRequest struct {
	// tenant isolation
	Namespace string

	// Checks is the list of individual check items to perform.
	// Maximum of 50 items allowed.
	Checks []BatchCheckItem

	// SkipCache forces the access checker to skip any caching layer for all checks.
	SkipCache bool
}

// BatchCheckResult represents the result of a single check in a batch.
type BatchCheckResult struct {
	// Allowed is true if the request is allowed, false otherwise.
	Allowed bool
	// Error contains any error that occurred during the check.
	Error error
}

// BatchCheckResponse contains results for all checks in a batch request.
type BatchCheckResponse struct {
	// Results maps each CorrelationID to its check result.
	Results map[string]BatchCheckResult
}

// Validate validates the BatchCheckRequest ensuring:
// - No more than 50 checks per request
// - All correlation IDs are non-empty and unique
// - All check items have required fields (Group, Resource, Verb)
func (r *BatchCheckRequest) Validate() error {
	if len(r.Checks) > MaxBatchCheckItems {
		return ErrTooManyChecks
	}

	seen := make(map[string]struct{}, len(r.Checks))
	for _, check := range r.Checks {
		if check.CorrelationID == "" {
			return ErrEmptyCorrelationID
		}
		if _, exists := seen[check.CorrelationID]; exists {
			return ErrDuplicateCorrelationID
		}
		seen[check.CorrelationID] = struct{}{}

		if check.Group == "" {
			return ErrMissingRequestGroup
		}
		if check.Resource == "" {
			return ErrMissingRequestResource
		}
		if check.Verb == "" {
			return ErrMissingRequestVerb
		}
	}

	return nil
}

// Checks access while iterating within a resource
type ItemChecker func(name, folder string) bool

type AccessLister interface {
	// Deprecated: Use BatchCheck instead. Compile generates a function to check
	// whether the id has access to items matching a request.
	// This is particularly useful when you want to verify access to a list of resources.
	// Returns nil if there is no access to any matching items
	Compile(ctx context.Context, info AuthInfo, req ListRequest) (ItemChecker, Zookie, error)

	// BatchCheck performs multiple access checks in a single request.
	// Checks can span different Group/Resource combinations.
	// Maximum of 50 checks per request.
	BatchCheck(ctx context.Context, info AuthInfo, req BatchCheckRequest) (BatchCheckResponse, error)
}

type AccessClient interface {
	AccessChecker
	AccessLister
}

// A simple client that always returns the same value
func FixedAccessClient(allowed bool) AccessClient {
	return &fixedClient{allowed}
}

type fixedClient struct {
	allowed bool
}

func (n *fixedClient) Check(ctx context.Context, _ AuthInfo, req CheckRequest, _ string) (CheckResponse, error) {
	if err := ValidateCheckRequest(req); err != nil {
		return CheckResponse{Allowed: false, Zookie: NoopZookie{}}, err
	}
	return CheckResponse{Allowed: n.allowed, Zookie: NoopZookie{}}, nil
}

func (n *fixedClient) Compile(ctx context.Context, _ AuthInfo, req ListRequest) (ItemChecker, Zookie, error) {
	if err := ValidateListRequest(req); err != nil {
		return nil, nil, err
	}
	return func(name, folder string) bool {
		return n.allowed
	}, &NoopZookie{}, nil
}

func (n *fixedClient) BatchCheck(ctx context.Context, _ AuthInfo, req BatchCheckRequest) (BatchCheckResponse, error) {
	if err := req.Validate(); err != nil {
		return BatchCheckResponse{}, err
	}

	results := make(map[string]BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		results[check.CorrelationID] = BatchCheckResult{
			Allowed: n.allowed,
			Error:   nil,
		}
	}

	return BatchCheckResponse{
		Results: results,
	}, nil
}

func ValidateCheckRequest(req CheckRequest) error {
	if req.Resource == "" {
		return ErrMissingRequestResource
	}
	if req.Group == "" {
		return ErrMissingRequestGroup
	}
	if req.Verb == "" {
		return ErrMissingRequestVerb
	}

	return nil
}

func ValidateListRequest(req ListRequest) error {
	if req.Resource == "" {
		return ErrMissingRequestResource
	}
	if req.Group == "" {
		return ErrMissingRequestGroup
	}
	if req.Verb == "" {
		return ErrMissingRequestVerb
	}

	return nil
}

// A Zookie that is always fresh
type NoopZookie struct{}

func (n NoopZookie) IsFresherThan(d time.Time) bool {
	return true
}
