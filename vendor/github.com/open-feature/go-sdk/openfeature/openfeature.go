package openfeature

import "github.com/go-logr/logr"

// api is the global evaluationImpl implementation. This is a singleton and there can only be one instance.
var (
	api      evaluationImpl
	eventing eventingImpl
)

// init initializes the OpenFeature evaluation API
func init() {
	initSingleton()
}

func initSingleton() {
	exec := newEventExecutor()
	eventing = exec

	api = newEvaluationAPI(exec)
}

// GetApiInstance returns the current singleton IEvaluation instance.
//
// Deprecated: use [NewDefaultClient] or [NewClient] directly instead
//
//nolint:staticcheck // Renaming this now would be a breaking change.
func GetApiInstance() IEvaluation {
	return api
}

// NewDefaultClient returns a [Client] for the default domain. The default domain [Client] is the [IClient] instance that
// wraps around an unnamed [FeatureProvider]
func NewDefaultClient() *Client {
	return newClient("", api, eventing)
}

// SetProvider sets the default [FeatureProvider]. Provider initialization is asynchronous and status can be checked from
// provider status
func SetProvider(provider FeatureProvider) error {
	return api.SetProvider(provider)
}

// SetProviderAndWait sets the default [FeatureProvider] and waits for its initialization.
// Returns an error if initialization causes an error
func SetProviderAndWait(provider FeatureProvider) error {
	return api.SetProviderAndWait(provider)
}

// ProviderMetadata returns the default [FeatureProvider] metadata
func ProviderMetadata() Metadata {
	return api.GetProviderMetadata()
}

// SetNamedProvider sets a [FeatureProvider] mapped to the given [Client] domain. Provider initialization is asynchronous
// and status can be checked from provider status
func SetNamedProvider(domain string, provider FeatureProvider) error {
	return api.SetNamedProvider(domain, provider, true)
}

// SetNamedProviderAndWait sets a provider mapped to the given [Client] domain and waits for its initialization.
// Returns an error if initialization cause error
func SetNamedProviderAndWait(domain string, provider FeatureProvider) error {
	return api.SetNamedProvider(domain, provider, false)
}

// NamedProviderMetadata returns the named provider's Metadata
func NamedProviderMetadata(name string) Metadata {
	return api.GetNamedProviderMetadata(name)
}

// SetEvaluationContext sets the global [EvaluationContext].
func SetEvaluationContext(evalCtx EvaluationContext) {
	api.SetEvaluationContext(evalCtx)
}

// SetLogger sets the global Logger.
//
// Deprecated: use [github.com/open-feature/go-sdk/openfeature/hooks.LoggingHook] instead.
func SetLogger(l logr.Logger) {
}

// AddHooks appends to the collection of any previously added hooks
func AddHooks(hooks ...Hook) {
	api.AddHooks(hooks...)
}

// AddHandler allows to add API level event handlers
func AddHandler(eventType EventType, callback EventCallback) {
	api.AddHandler(eventType, callback)
}

// RemoveHandler allows for removal of API level event handlers
func RemoveHandler(eventType EventType, callback EventCallback) {
	api.RemoveHandler(eventType, callback)
}

// Shutdown unconditionally calls shutdown on all registered providers,
// regardless of their state. It resets the state of the API, removing all
// hooks, event handlers, and providers.
func Shutdown() {
	api.Shutdown()
	initSingleton()
}
