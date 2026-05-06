package openfeature

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"unicode/utf8"

	"github.com/go-logr/logr"
)

// ClientMetadata provides a client's metadata
type ClientMetadata struct {
	domain string
}

// NewClientMetadata constructs ClientMetadata
// Allows for simplified hook test cases while maintaining immutability
func NewClientMetadata(domain string) ClientMetadata {
	return ClientMetadata{
		domain: domain,
	}
}

// Name returns the client's domain name
// Deprecated: Name() exists for historical compatibility, use Domain() instead.
func (cm ClientMetadata) Name() string {
	return cm.domain
}

// Domain returns the client's domain
func (cm ClientMetadata) Domain() string {
	return cm.domain
}

// Client implements the behaviour required of an openfeature client
type Client struct {
	api               evaluationImpl
	clientEventing    clientEvent
	metadata          ClientMetadata
	hooks             []Hook
	evaluationContext EvaluationContext
	domain            string

	mx sync.RWMutex
}

// interface guard to ensure that Client implements IClient
var _ IClient = (*Client)(nil)

// NewClient returns a new Client. Name is a unique identifier for this client
// This helper exists for historical reasons. It is recommended to interact with IEvaluation to derive IClient instances.
func NewClient(domain string) *Client {
	return newClient(domain, api, eventing)
}

func newClient(domain string, apiRef evaluationImpl, eventRef clientEvent) *Client {
	return &Client{
		domain:            domain,
		api:               apiRef,
		clientEventing:    eventRef,
		metadata:          ClientMetadata{domain: domain},
		hooks:             []Hook{},
		evaluationContext: EvaluationContext{},
	}
}

// State returns the state of the associated provider
func (c *Client) State() State {
	return c.clientEventing.State(c.domain)
}

// Deprecated
// WithLogger sets the logger of the client
func (c *Client) WithLogger(l logr.Logger) *Client {
	c.mx.Lock()
	defer c.mx.Unlock()
	return c
}

// Metadata returns the client's metadata
func (c *Client) Metadata() ClientMetadata {
	c.mx.RLock()
	defer c.mx.RUnlock()
	return c.metadata
}

// AddHooks appends to the client's collection of any previously added hooks
func (c *Client) AddHooks(hooks ...Hook) {
	c.mx.Lock()
	defer c.mx.Unlock()
	c.hooks = append(c.hooks, hooks...)
}

// AddHandler allows to add Client level event handler
func (c *Client) AddHandler(eventType EventType, callback EventCallback) {
	c.clientEventing.AddClientHandler(c.metadata.Domain(), eventType, callback)
}

// RemoveHandler allows to remove Client level event handler
func (c *Client) RemoveHandler(eventType EventType, callback EventCallback) {
	c.clientEventing.RemoveClientHandler(c.metadata.Domain(), eventType, callback)
}

// SetEvaluationContext sets the client's evaluation context
func (c *Client) SetEvaluationContext(evalCtx EvaluationContext) {
	c.mx.Lock()
	defer c.mx.Unlock()
	c.evaluationContext = evalCtx
}

// EvaluationContext returns the client's evaluation context
func (c *Client) EvaluationContext() EvaluationContext {
	c.mx.RLock()
	defer c.mx.RUnlock()
	return c.evaluationContext
}

// Type represents the type of a flag
type Type int64

const (
	Boolean Type = iota
	String
	Float
	Int
	Object
)

func (t Type) String() string {
	return typeToString[t]
}

var typeToString = map[Type]string{
	Boolean: "bool",
	String:  "string",
	Float:   "float",
	Int:     "int",
	Object:  "object",
}

type EvaluationDetails struct {
	FlagKey  string
	FlagType Type
	ResolutionDetail
}

type BooleanEvaluationDetails struct {
	Value bool
	EvaluationDetails
}

type StringEvaluationDetails struct {
	Value string
	EvaluationDetails
}

type FloatEvaluationDetails struct {
	Value float64
	EvaluationDetails
}

type IntEvaluationDetails struct {
	Value int64
	EvaluationDetails
}

type InterfaceEvaluationDetails struct {
	Value interface{}
	EvaluationDetails
}

type ResolutionDetail struct {
	Variant      string
	Reason       Reason
	ErrorCode    ErrorCode
	ErrorMessage string
	FlagMetadata FlagMetadata
}

// FlagMetadata is a structure which supports definition of arbitrary properties, with keys of type string, and values
// of type boolean, string, int64 or float64. This structure is populated by a provider for use by an Application
// Author (via the Evaluation API) or an Application Integrator (via hooks).
type FlagMetadata map[string]interface{}

// GetString fetch string value from FlagMetadata.
// Returns an error if the key does not exist, or, the value is of the wrong type
func (f FlagMetadata) GetString(key string) (string, error) {
	v, ok := f[key]
	if !ok {
		return "", fmt.Errorf("key %s does not exist in FlagMetadata", key)
	}
	switch t := v.(type) {
	case string:
		return v.(string), nil
	default:
		return "", fmt.Errorf("wrong type for key %s, expected string, got %T", key, t)
	}
}

// GetBool fetch bool value from FlagMetadata.
// Returns an error if the key does not exist, or, the value is of the wrong type
func (f FlagMetadata) GetBool(key string) (bool, error) {
	v, ok := f[key]
	if !ok {
		return false, fmt.Errorf("key %s does not exist in FlagMetadata", key)
	}
	switch t := v.(type) {
	case bool:
		return v.(bool), nil
	default:
		return false, fmt.Errorf("wrong type for key %s, expected bool, got %T", key, t)
	}
}

// GetInt fetch int64 value from FlagMetadata.
// Returns an error if the key does not exist, or, the value is of the wrong type
func (f FlagMetadata) GetInt(key string) (int64, error) {
	v, ok := f[key]
	if !ok {
		return 0, fmt.Errorf("key %s does not exist in FlagMetadata", key)
	}
	switch t := v.(type) {
	case int:
		return int64(v.(int)), nil
	case int8:
		return int64(v.(int8)), nil
	case int16:
		return int64(v.(int16)), nil
	case int32:
		return int64(v.(int32)), nil
	case int64:
		return v.(int64), nil
	default:
		return 0, fmt.Errorf("wrong type for key %s, expected integer, got %T", key, t)
	}
}

// GetFloat fetch float64 value from FlagMetadata.
// Returns an error if the key does not exist, or, the value is of the wrong type
func (f FlagMetadata) GetFloat(key string) (float64, error) {
	v, ok := f[key]
	if !ok {
		return 0, fmt.Errorf("key %s does not exist in FlagMetadata", key)
	}
	switch t := v.(type) {
	case float32:
		return float64(v.(float32)), nil
	case float64:
		return v.(float64), nil
	default:
		return 0, fmt.Errorf("wrong type for key %s, expected float, got %T", key, t)
	}
}

// Option applies a change to EvaluationOptions
type Option func(*EvaluationOptions)

// EvaluationOptions should contain a list of hooks to be executed for a flag evaluation
type EvaluationOptions struct {
	hooks     []Hook
	hookHints HookHints
}

// HookHints returns evaluation options' hook hints
func (e EvaluationOptions) HookHints() HookHints {
	return e.hookHints
}

// Hooks returns evaluation options' hooks
func (e EvaluationOptions) Hooks() []Hook {
	return e.hooks
}

// WithHooks applies provided hooks.
func WithHooks(hooks ...Hook) Option {
	return func(options *EvaluationOptions) {
		options.hooks = hooks
	}
}

// WithHookHints applies provided hook hints.
func WithHookHints(hookHints HookHints) Option {
	return func(options *EvaluationOptions) {
		options.hookHints = hookHints
	}
}

// BooleanValue performs a flag evaluation that returns a boolean.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) BooleanValue(ctx context.Context, flag string, defaultValue bool, evalCtx EvaluationContext, options ...Option) (bool, error) {
	details, err := c.BooleanValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return defaultValue, err
	}

	return details.Value, nil
}

// StringValue performs a flag evaluation that returns a string.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) StringValue(ctx context.Context, flag string, defaultValue string, evalCtx EvaluationContext, options ...Option) (string, error) {
	details, err := c.StringValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return defaultValue, err
	}

	return details.Value, nil
}

// FloatValue performs a flag evaluation that returns a float64.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) FloatValue(ctx context.Context, flag string, defaultValue float64, evalCtx EvaluationContext, options ...Option) (float64, error) {
	details, err := c.FloatValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return defaultValue, err
	}

	return details.Value, nil
}

// IntValue performs a flag evaluation that returns an int64.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) IntValue(ctx context.Context, flag string, defaultValue int64, evalCtx EvaluationContext, options ...Option) (int64, error) {
	details, err := c.IntValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return defaultValue, err
	}

	return details.Value, nil
}

// ObjectValue performs a flag evaluation that returns an object.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) ObjectValue(ctx context.Context, flag string, defaultValue interface{}, evalCtx EvaluationContext, options ...Option) (interface{}, error) {
	details, err := c.ObjectValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return defaultValue, err
	}

	return details.Value, nil
}

// BooleanValueDetails performs a flag evaluation that returns an evaluation details struct.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) BooleanValueDetails(ctx context.Context, flag string, defaultValue bool, evalCtx EvaluationContext, options ...Option) (BooleanEvaluationDetails, error) {
	c.mx.RLock()
	defer c.mx.RUnlock()

	evalOptions := &EvaluationOptions{}
	for _, option := range options {
		option(evalOptions)
	}

	evalDetails, err := c.evaluate(ctx, flag, Boolean, defaultValue, evalCtx, *evalOptions)
	if err != nil {
		return BooleanEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(bool)
	if !ok {
		err := errors.New("evaluated value is not a boolean")
		boolEvalDetails := BooleanEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		boolEvalDetails.EvaluationDetails.ErrorCode = TypeMismatchCode
		boolEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return boolEvalDetails, err
	}

	return BooleanEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

// StringValueDetails performs a flag evaluation that returns an evaluation details struct.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) StringValueDetails(ctx context.Context, flag string, defaultValue string, evalCtx EvaluationContext, options ...Option) (StringEvaluationDetails, error) {
	c.mx.RLock()
	defer c.mx.RUnlock()

	evalOptions := &EvaluationOptions{}
	for _, option := range options {
		option(evalOptions)
	}

	evalDetails, err := c.evaluate(ctx, flag, String, defaultValue, evalCtx, *evalOptions)
	if err != nil {
		return StringEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(string)
	if !ok {
		err := errors.New("evaluated value is not a string")
		strEvalDetails := StringEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		strEvalDetails.EvaluationDetails.ErrorCode = TypeMismatchCode
		strEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return strEvalDetails, err
	}

	return StringEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

// FloatValueDetails performs a flag evaluation that returns an evaluation details struct.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) FloatValueDetails(ctx context.Context, flag string, defaultValue float64, evalCtx EvaluationContext, options ...Option) (FloatEvaluationDetails, error) {
	c.mx.RLock()
	defer c.mx.RUnlock()

	evalOptions := &EvaluationOptions{}
	for _, option := range options {
		option(evalOptions)
	}

	evalDetails, err := c.evaluate(ctx, flag, Float, defaultValue, evalCtx, *evalOptions)
	if err != nil {
		return FloatEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(float64)
	if !ok {
		err := errors.New("evaluated value is not a float64")
		floatEvalDetails := FloatEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		floatEvalDetails.EvaluationDetails.ErrorCode = TypeMismatchCode
		floatEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return floatEvalDetails, err
	}

	return FloatEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

// IntValueDetails performs a flag evaluation that returns an evaluation details struct.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) IntValueDetails(ctx context.Context, flag string, defaultValue int64, evalCtx EvaluationContext, options ...Option) (IntEvaluationDetails, error) {
	c.mx.RLock()
	defer c.mx.RUnlock()

	evalOptions := &EvaluationOptions{}
	for _, option := range options {
		option(evalOptions)
	}

	evalDetails, err := c.evaluate(ctx, flag, Int, defaultValue, evalCtx, *evalOptions)
	if err != nil {
		return IntEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(int64)
	if !ok {
		err := errors.New("evaluated value is not an int64")
		intEvalDetails := IntEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		intEvalDetails.EvaluationDetails.ErrorCode = TypeMismatchCode
		intEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return intEvalDetails, err
	}

	return IntEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

// ObjectValueDetails performs a flag evaluation that returns an evaluation details struct.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) ObjectValueDetails(ctx context.Context, flag string, defaultValue interface{}, evalCtx EvaluationContext, options ...Option) (InterfaceEvaluationDetails, error) {
	c.mx.RLock()
	defer c.mx.RUnlock()

	evalOptions := &EvaluationOptions{}
	for _, option := range options {
		option(evalOptions)
	}

	return c.evaluate(ctx, flag, Object, defaultValue, evalCtx, *evalOptions)
}

// Boolean performs a flag evaluation that returns a boolean. Any error
// encountered during the evaluation will result in the default value being
// returned. To explicitly handle errors, use [BooleanValue] or [BooleanValueDetails]
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) Boolean(ctx context.Context, flag string, defaultValue bool, evalCtx EvaluationContext, options ...Option) bool {
	value, _ := c.BooleanValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

// String performs a flag evaluation that returns a string. Any error
// encountered during the evaluation will result in the default value being
// returned. To explicitly handle errors, use [StringValue] or [StringValueDetails]
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) String(ctx context.Context, flag string, defaultValue string, evalCtx EvaluationContext, options ...Option) string {
	value, _ := c.StringValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

// Float performs a flag evaluation that returns a float64. Any error
// encountered during the evaluation will result in the default value being
// returned. To explicitly handle errors, use [FloatValue] or [FloatValueDetails]
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) Float(ctx context.Context, flag string, defaultValue float64, evalCtx EvaluationContext, options ...Option) float64 {
	value, _ := c.FloatValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

// Int performs a flag evaluation that returns an int64. Any error
// encountered during the evaluation will result in the default value being
// returned. To explicitly handle errors, use [IntValue] or [IntValueDetails]
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) Int(ctx context.Context, flag string, defaultValue int64, evalCtx EvaluationContext, options ...Option) int64 {
	value, _ := c.IntValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

// Object performs a flag evaluation that returns an object. Any error
// encountered during the evaluation will result in the default value being
// returned. To explicitly handle errors, use [ObjectValue] or [ObjectValueDetails]
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - flag is the key that uniquely identifies a particular flag
// - defaultValue is returned if an error occurs
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - options are optional additional evaluation options e.g. WithHooks & WithHookHints
func (c *Client) Object(ctx context.Context, flag string, defaultValue interface{}, evalCtx EvaluationContext, options ...Option) interface{} {
	value, _ := c.ObjectValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

// Track performs an action for tracking for occurrence  of a particular action or application state.
//
// Parameters:
// - ctx is the standard go context struct used to manage requests (e.g. timeouts)
// - trackingEventName is the event name to track
// - evalCtx is the evaluation context used in a flag evaluation (not to be confused with ctx)
// - trackingEventDetails defines optional data pertinent to a particular
func (c *Client) Track(ctx context.Context, trackingEventName string, evalCtx EvaluationContext, details TrackingEventDetails) {
	provider, evalCtx := c.forTracking(ctx, evalCtx)
	provider.Track(ctx, trackingEventName, evalCtx, details)
}

// forTracking return the TrackingHandler and the combination of EvaluationContext from api, transaction, client and invocation.
//
// The returned evaluation context MUST be merged in the order, with duplicate values being overwritten:
// - API (global; lowest precedence)
// - transaction
// - client
// - invocation (highest precedence)
func (c *Client) forTracking(ctx context.Context, evalCtx EvaluationContext) (Tracker, EvaluationContext) {
	provider, _, apiCtx := c.api.ForEvaluation(c.metadata.domain)
	evalCtx = mergeContexts(evalCtx, c.evaluationContext, TransactionContext(ctx), apiCtx)
	trackingProvider, ok := provider.(Tracker)
	if !ok {
		trackingProvider = NoopProvider{}
	}
	return trackingProvider, evalCtx
}

func (c *Client) evaluate(
	ctx context.Context, flag string, flagType Type, defaultValue interface{}, evalCtx EvaluationContext, options EvaluationOptions,
) (InterfaceEvaluationDetails, error) {
	evalDetails := InterfaceEvaluationDetails{
		Value: defaultValue,
		EvaluationDetails: EvaluationDetails{
			FlagKey:  flag,
			FlagType: flagType,
		},
	}

	if !utf8.Valid([]byte(flag)) {
		return evalDetails, NewParseErrorResolutionError("flag key is not a UTF-8 encoded string")
	}

	// ensure that the same provider & hooks are used across this transaction to avoid unexpected behaviour
	provider, globalHooks, globalCtx := c.api.ForEvaluation(c.metadata.domain)

	evalCtx = mergeContexts(evalCtx, c.evaluationContext, TransactionContext(ctx), globalCtx)                                  // API (global) -> transaction -> client -> invocation
	apiClientInvocationProviderHooks := append(append(append(globalHooks, c.hooks...), options.hooks...), provider.Hooks()...) // API, Client, Invocation, Provider
	providerInvocationClientApiHooks := append(append(append(provider.Hooks(), options.hooks...), c.hooks...), globalHooks...) // Provider, Invocation, Client, API

	var err error
	hookCtx := HookContext{
		flagKey:           flag,
		flagType:          flagType,
		defaultValue:      defaultValue,
		clientMetadata:    c.metadata,
		providerMetadata:  provider.Metadata(),
		evaluationContext: evalCtx,
	}

	defer func() {
		c.finallyHooks(ctx, hookCtx, providerInvocationClientApiHooks, options)
	}()

        // bypass short-circuit logic for the Noop provider; it is essentially stateless and a "special case"
	if _, ok := provider.(NoopProvider); !ok {
		// short circuit if provider is in NOT READY state
		if c.State() == NotReadyState {
			c.errorHooks(ctx, hookCtx, providerInvocationClientApiHooks, ProviderNotReadyError, options)
			return evalDetails, ProviderNotReadyError
		}

		// short circuit if provider is in FATAL state
		if c.State() == FatalState {
			c.errorHooks(ctx, hookCtx, providerInvocationClientApiHooks, ProviderFatalError, options)
			return evalDetails, ProviderFatalError
		}
	}

	evalCtx, err = c.beforeHooks(ctx, hookCtx, apiClientInvocationProviderHooks, evalCtx, options)
	hookCtx.evaluationContext = evalCtx
	if err != nil {
		err = fmt.Errorf("before hook: %w", err)
		c.errorHooks(ctx, hookCtx, providerInvocationClientApiHooks, err, options)
		return evalDetails, err
	}

	flatCtx := flattenContext(evalCtx)
	var resolution InterfaceResolutionDetail
	switch flagType {
	case Object:
		resolution = provider.ObjectEvaluation(ctx, flag, defaultValue, flatCtx)
	case Boolean:
		defValue := defaultValue.(bool)
		res := provider.BooleanEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	case String:
		defValue := defaultValue.(string)
		res := provider.StringEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	case Float:
		defValue := defaultValue.(float64)
		res := provider.FloatEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	case Int:
		defValue := defaultValue.(int64)
		res := provider.IntEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	}

	err = resolution.Error()
	if err != nil {
		err = fmt.Errorf("error code: %w", err)
		c.errorHooks(ctx, hookCtx, providerInvocationClientApiHooks, err, options)
		evalDetails.ResolutionDetail = resolution.ResolutionDetail()
		evalDetails.Reason = ErrorReason
		return evalDetails, err
	}
	evalDetails.Value = resolution.Value
	evalDetails.ResolutionDetail = resolution.ResolutionDetail()

	if err := c.afterHooks(ctx, hookCtx, providerInvocationClientApiHooks, evalDetails, options); err != nil {
		err = fmt.Errorf("after hook: %w", err)
		c.errorHooks(ctx, hookCtx, providerInvocationClientApiHooks, err, options)
		return evalDetails, err
	}

	return evalDetails, nil
}

func flattenContext(evalCtx EvaluationContext) FlattenedContext {
	flatCtx := FlattenedContext{}
	if evalCtx.attributes != nil {
		flatCtx = evalCtx.Attributes()
	}
	if evalCtx.targetingKey != "" {
		flatCtx[TargetingKey] = evalCtx.targetingKey
	}
	return flatCtx
}

func (c *Client) beforeHooks(
	ctx context.Context, hookCtx HookContext, hooks []Hook, evalCtx EvaluationContext, options EvaluationOptions,
) (EvaluationContext, error) {
	for _, hook := range hooks {
		resultEvalCtx, err := hook.Before(ctx, hookCtx, options.hookHints)
		if resultEvalCtx != nil {
			hookCtx.evaluationContext = *resultEvalCtx
		}
		if err != nil {
			return mergeContexts(hookCtx.evaluationContext, evalCtx), err
		}
	}

	return mergeContexts(hookCtx.evaluationContext, evalCtx), nil
}

func (c *Client) afterHooks(
	ctx context.Context, hookCtx HookContext, hooks []Hook, evalDetails InterfaceEvaluationDetails, options EvaluationOptions,
) error {
	for _, hook := range hooks {
		if err := hook.After(ctx, hookCtx, evalDetails, options.hookHints); err != nil {
			return err
		}
	}

	return nil
}

func (c *Client) errorHooks(ctx context.Context, hookCtx HookContext, hooks []Hook, err error, options EvaluationOptions) {
	for _, hook := range hooks {
		hook.Error(ctx, hookCtx, err, options.hookHints)
	}
}

func (c *Client) finallyHooks(ctx context.Context, hookCtx HookContext, hooks []Hook, options EvaluationOptions) {
	for _, hook := range hooks {
		hook.Finally(ctx, hookCtx, options.hookHints)
	}
}

// merges attributes from the given EvaluationContexts with the nth EvaluationContext taking precedence in case
// of any conflicts with the (n+1)th EvaluationContext
func mergeContexts(evaluationContexts ...EvaluationContext) EvaluationContext {
	if len(evaluationContexts) == 0 {
		return EvaluationContext{}
	}

	// create copy to prevent mutation of given EvaluationContext
	mergedCtx := EvaluationContext{
		attributes:   evaluationContexts[0].Attributes(),
		targetingKey: evaluationContexts[0].targetingKey,
	}

	for i := 1; i < len(evaluationContexts); i++ {
		if mergedCtx.targetingKey == "" && evaluationContexts[i].targetingKey != "" {
			mergedCtx.targetingKey = evaluationContexts[i].targetingKey
		}

		for k, v := range evaluationContexts[i].attributes {
			_, ok := mergedCtx.attributes[k]
			if !ok {
				mergedCtx.attributes[k] = v
			}
		}
	}

	return mergedCtx
}
