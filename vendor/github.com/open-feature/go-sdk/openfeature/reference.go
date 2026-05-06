package openfeature

import (
	"reflect"
)

// newProviderRef creates a new providerReference instance that wraps around a FeatureProvider implementation
func newProviderRef(provider FeatureProvider) providerReference {
	return providerReference{
		featureProvider:   provider,
		kind:              reflect.TypeOf(provider).Kind(),
		shutdownSemaphore: make(chan interface{}),
	}
}

// providerReference is a helper struct to store FeatureProvider along with their
// shutdown semaphore
type providerReference struct {
	featureProvider   FeatureProvider
	kind              reflect.Kind
	shutdownSemaphore chan interface{}
}

func (pr providerReference) equals(other providerReference) bool {
	if pr.kind == reflect.Ptr && other.kind == reflect.Ptr {
		return pr.featureProvider == other.featureProvider
	}
	return reflect.DeepEqual(pr.featureProvider, other.featureProvider)
}
