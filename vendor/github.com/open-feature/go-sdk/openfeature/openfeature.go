package openfeature

import "github.com/go-logr/logr"

// api is the global evaluationImpl implementation. This is a singleton and there can only be one instance.
var api evaluationImpl
var eventing eventingImpl

// init initializes the OpenFeature evaluation API
func init() {
	initSingleton()
}

func initSingleton() {
	var exec = newEventExecutor()
	eventing = exec

	api = newEvaluationAPI(exec)
}

// GetApiInstance returns the current singleton IEvaluation instance.
// This is the preferred interface to interact with OpenFeature functionalities
func GetApiInstance() IEvaluation {
	return api
}

// SetProvider sets the default provider. Provider initialization is asynchronous and status can be checked from
// provider status
func SetProvider(provider FeatureProvider) error {
	return api.SetProvider(provider)
}

// SetProviderAndWait sets the default provider and waits for its initialization.
// Returns an error if initialization cause error
func SetProviderAndWait(provider FeatureProvider) error {
	return api.SetProviderAndWait(provider)
}

// ProviderMetadata returns the default provider's metadata
func ProviderMetadata() Metadata {
	return api.GetProviderMetadata()
}

// SetNamedProvider sets a provider mapped to the given Client domain. Provider initialization is asynchronous and
// status can be checked from provider status
func SetNamedProvider(domain string, provider FeatureProvider) error {
	return api.SetNamedProvider(domain, provider, true)
}

// SetNamedProviderAndWait sets a provider mapped to the given Client domain and waits for its initialization.
// Returns an error if initialization cause error
func SetNamedProviderAndWait(domain string, provider FeatureProvider) error {
	return api.SetNamedProvider(domain, provider, false)
}

// NamedProviderMetadata returns the named provider's Metadata
func NamedProviderMetadata(name string) Metadata {
	return api.GetNamedProviderMetadata(name)
}

// SetEvaluationContext sets the global evaluation context.
func SetEvaluationContext(evalCtx EvaluationContext) {
	api.SetEvaluationContext(evalCtx)
}

// Deprecated
// SetLogger sets the global Logger.
func SetLogger(l logr.Logger) {
}

// AddHooks appends to the collection of any previously added hooks
func AddHooks(hooks ...Hook) {
	api.AddHooks(hooks...)
}

// AddHandler allows to add API level event handler
func AddHandler(eventType EventType, callback EventCallback) {
	api.AddHandler(eventType, callback)
}

// RemoveHandler allows to remove API level event handler
func RemoveHandler(eventType EventType, callback EventCallback) {
	api.RemoveHandler(eventType, callback)
}

// Shutdown active providers
func Shutdown() {
	api.Shutdown()
}
