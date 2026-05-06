package openfeature

import (
	"context"
	"errors"
)

const (
	// DefaultReason - the resolved value was configured statically, or otherwise fell back to a pre-configured value.
	DefaultReason Reason = "DEFAULT"
	// TargetingMatchReason - the resolved value was the result of a dynamic evaluation, such as a rule or specific user-targeting.
	TargetingMatchReason Reason = "TARGETING_MATCH"
	// SplitReason - the resolved value was the result of pseudorandom assignment.
	SplitReason Reason = "SPLIT"
	// DisabledReason - the resolved value was the result of the flag being disabled in the management system.
	DisabledReason Reason = "DISABLED"
	// StaticReason - the resolved value is static (no dynamic evaluation)
	StaticReason Reason = "STATIC"
	// CachedReason - the resolved value was retrieved from cache
	CachedReason Reason = "CACHED"
	// UnknownReason - the reason for the resolved value could not be determined.
	UnknownReason Reason = "UNKNOWN"
	// ErrorReason - the resolved value was the result of an error.
	ErrorReason Reason = "ERROR"

	NotReadyState State = "NOT_READY"
	ReadyState    State = "READY"
	ErrorState    State = "ERROR"
	StaleState    State = "STALE"
	FatalState    State = "FATAL"

	ProviderReady        EventType = "PROVIDER_READY"
	ProviderConfigChange EventType = "PROVIDER_CONFIGURATION_CHANGED"
	ProviderStale        EventType = "PROVIDER_STALE"
	ProviderError        EventType = "PROVIDER_ERROR"

	TargetingKey string = "targetingKey" // evaluation context map key. The targeting key uniquely identifies the subject (end-user, or client service) of a flag evaluation.
)

// FlattenedContext contains metadata for a given flag evaluation in a flattened structure.
// TargetingKey ("targetingKey") is stored as a string value if provided in the evaluation context.
type FlattenedContext map[string]interface{}

// Reason indicates the semantic reason for a returned flag value
type Reason string

// FeatureProvider interface defines a set of functions that can be called in order to evaluate a flag.
// This should be implemented by flag management systems.
type FeatureProvider interface {
	Metadata() Metadata
	BooleanEvaluation(ctx context.Context, flag string, defaultValue bool, evalCtx FlattenedContext) BoolResolutionDetail
	StringEvaluation(ctx context.Context, flag string, defaultValue string, evalCtx FlattenedContext) StringResolutionDetail
	FloatEvaluation(ctx context.Context, flag string, defaultValue float64, evalCtx FlattenedContext) FloatResolutionDetail
	IntEvaluation(ctx context.Context, flag string, defaultValue int64, evalCtx FlattenedContext) IntResolutionDetail
	ObjectEvaluation(ctx context.Context, flag string, defaultValue interface{}, evalCtx FlattenedContext) InterfaceResolutionDetail
	Hooks() []Hook
}

// State represents the status of the provider
type State string

// StateHandler is the contract for initialization & shutdown.
// FeatureProvider can opt in for this behavior by implementing the interface
type StateHandler interface {
	Init(evaluationContext EvaluationContext) error
	Shutdown()
}

// Tracker is the contract for tracking
// FeatureProvider can opt in for this behavior by implementing the interface
type Tracker interface {
	Track(ctx context.Context, trackingEventName string, evaluationContext EvaluationContext, details TrackingEventDetails)
}

// NoopStateHandler is a noop StateHandler implementation
// Status always set to ReadyState to comply with specification
type NoopStateHandler struct {
}

func (s *NoopStateHandler) Init(e EvaluationContext) error {
	// NOOP
	return nil
}

func (s *NoopStateHandler) Shutdown() {
	// NOOP
}

func (s *NoopStateHandler) Status() State {
	return ReadyState
}

// Eventing

// EventHandler is the eventing contract enforced for FeatureProvider
type EventHandler interface {
	EventChannel() <-chan Event
}

// EventType emitted by a provider implementation
type EventType string

// ProviderEventDetails is the event payload emitted by FeatureProvider
type ProviderEventDetails struct {
	Message       string
	FlagChanges   []string
	EventMetadata map[string]interface{}
	ErrorCode     ErrorCode
}

// Event is an event emitted by a FeatureProvider.
type Event struct {
	ProviderName string
	EventType
	ProviderEventDetails
}

type EventDetails struct {
	ProviderName string
	ProviderEventDetails
}

type EventCallback *func(details EventDetails)

// NoopEventHandler is the out-of-the-box EventHandler which is noop
type NoopEventHandler struct {
}

func (s NoopEventHandler) EventChannel() <-chan Event {
	return make(chan Event, 1)
}

// ProviderResolutionDetail is a structure which contains a subset of the fields defined in the EvaluationDetail,
// representing the result of the provider's flag resolution process
// see https://github.com/open-feature/spec/blob/main/specification/types.md#resolution-details
// N.B we could use generics but to support older versions of go for now we will have type specific resolution
// detail
type ProviderResolutionDetail struct {
	ResolutionError ResolutionError
	Reason          Reason
	Variant         string
	FlagMetadata    FlagMetadata
}

func (p ProviderResolutionDetail) ResolutionDetail() ResolutionDetail {
	metadata := FlagMetadata{}
	if p.FlagMetadata != nil {
		metadata = p.FlagMetadata
	}
	return ResolutionDetail{
		Variant:      p.Variant,
		Reason:       p.Reason,
		ErrorCode:    p.ResolutionError.code,
		ErrorMessage: p.ResolutionError.message,
		FlagMetadata: metadata,
	}
}

func (p ProviderResolutionDetail) Error() error {
	if p.ResolutionError.code == "" {
		return nil
	}
	return errors.New(p.ResolutionError.Error())
}

// BoolResolutionDetail provides a resolution detail with boolean type
type BoolResolutionDetail struct {
	Value bool
	ProviderResolutionDetail
}

// StringResolutionDetail provides a resolution detail with string type
type StringResolutionDetail struct {
	Value string
	ProviderResolutionDetail
}

// FloatResolutionDetail provides a resolution detail with float64 type
type FloatResolutionDetail struct {
	Value float64
	ProviderResolutionDetail
}

// IntResolutionDetail provides a resolution detail with int64 type
type IntResolutionDetail struct {
	Value int64
	ProviderResolutionDetail
}

// InterfaceResolutionDetail provides a resolution detail with interface{} type
type InterfaceResolutionDetail struct {
	Value interface{}
	ProviderResolutionDetail
}

// Metadata provides provider name
type Metadata struct {
	Name string
}

// TrackingEventDetails provides a tracking details with float64 value
type TrackingEventDetails struct {
	value      float64
	attributes map[string]interface{}
}

// NewTrackingEventDetails return TrackingEventDetails associated with numeric value value
func NewTrackingEventDetails(value float64) TrackingEventDetails {
	return TrackingEventDetails{
		value:      value,
		attributes: make(map[string]interface{}),
	}
}

// Add insert new key-value pair into TrackingEventDetails and return the TrackingEventDetails itself.
// If the key already exists in TrackingEventDetails, it will be replaced.
//
// Usage: trackingEventDetails.Add('active-time', 2).Add('unit': 'seconds')
func (t TrackingEventDetails) Add(key string, value interface{}) TrackingEventDetails {
	t.attributes[key] = value
	return t
}

// Attributes return a map contains the key-value pairs stored in TrackingEventDetails.
func (t TrackingEventDetails) Attributes() map[string]interface{} {
	// copy fields to new map to prevent mutation (maps are passed by reference)
	fields := make(map[string]interface{}, len(t.attributes))
	for key, value := range t.attributes {
		fields[key] = value
	}
	return fields
}

// Attribute retrieves the attribute with the given key.
func (t TrackingEventDetails) Attribute(key string) interface{} {
	return t.attributes[key]
}

// Copy return a new TrackingEventDetails with new value.
// It will copy details of old TrackingEventDetails into the new one to ensure the immutability.
func (t TrackingEventDetails) Copy(value float64) TrackingEventDetails {
	return TrackingEventDetails{
		value:      value,
		attributes: t.Attributes(),
	}
}

// Value retrieves the value of TrackingEventDetails.
func (t TrackingEventDetails) Value() float64 {
	return t.value
}
