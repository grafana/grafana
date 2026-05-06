package openfeature

import (
	"fmt"
	"sync"
	"time"

	"log/slog"

	"golang.org/x/exp/maps"
)

const defaultDomain = ""

// event executor is a registry to connect API and Client event handlers to Providers

// eventExecutor handles events emitted from FeatureProvider. It follows a pub-sub model based on channels.
// Emitted events are written to eventChan. This model is chosen so that events can be triggered from subscribed
// feature provider as well as from API(ex:- for initialization events).
// Usage of channels help with concurrency and adhere to the principal of sharing memory by communication.
type eventExecutor struct {
	states                   sync.Map
	defaultProviderReference providerReference
	namedProviderReference   map[string]providerReference
	activeSubscriptions      []providerReference
	apiRegistry              map[EventType][]EventCallback
	scopedRegistry           map[string]scopedCallback
	eventChan                chan eventPayload
	once                     sync.Once
	mu                       sync.Mutex
}

func newEventExecutor() *eventExecutor {
	executor := eventExecutor{
		states:                 sync.Map{},
		namedProviderReference: map[string]providerReference{},
		activeSubscriptions:    []providerReference{},
		apiRegistry:            map[EventType][]EventCallback{},
		scopedRegistry:         map[string]scopedCallback{},
		eventChan:              make(chan eventPayload, 5),
	}

	executor.startEventListener()
	return &executor
}

// scopedCallback is a helper struct to hold client domain associated callbacks.
// Here, the scope correlates to the client and provider domain
type scopedCallback struct {
	scope     string
	callbacks map[EventType][]EventCallback
}

func (s *scopedCallback) eventCallbacks() map[EventType][]EventCallback {
	return s.callbacks
}

func newScopedCallback(client string) scopedCallback {
	return scopedCallback{
		scope:     client,
		callbacks: map[EventType][]EventCallback{},
	}
}

type eventPayload struct {
	event   Event
	handler FeatureProvider
}

// AddHandler adds an API(global) level handler
func (e *eventExecutor) AddHandler(t EventType, c EventCallback) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.apiRegistry[t] == nil {
		e.apiRegistry[t] = []EventCallback{c}
	} else {
		e.apiRegistry[t] = append(e.apiRegistry[t], c)
	}

	e.emitOnRegistration(defaultDomain, e.defaultProviderReference, t, c)
}

// RemoveHandler removes an API(global) level handler
func (e *eventExecutor) RemoveHandler(t EventType, c EventCallback) {
	e.mu.Lock()
	defer e.mu.Unlock()

	entrySlice, ok := e.apiRegistry[t]
	if !ok {
		// nothing to remove
		return
	}

	for i, f := range entrySlice {
		if f == c {
			entrySlice = append(entrySlice[:i], entrySlice[i+1:]...)
		}
	}

	e.apiRegistry[t] = entrySlice
}

// AddClientHandler registers a client level handler
func (e *eventExecutor) AddClientHandler(domain string, t EventType, c EventCallback) {
	e.mu.Lock()
	defer e.mu.Unlock()

	_, ok := e.scopedRegistry[domain]
	if !ok {
		e.scopedRegistry[domain] = newScopedCallback(domain)
	}

	registry := e.scopedRegistry[domain]

	if registry.callbacks[t] == nil {
		registry.callbacks[t] = []EventCallback{c}
	} else {
		registry.callbacks[t] = append(registry.callbacks[t], c)
	}

	reference, ok := e.namedProviderReference[domain]
	if !ok {
		// fallback to default
		reference = e.defaultProviderReference
	}

	e.emitOnRegistration(domain, reference, t, c)
}

// RemoveClientHandler removes a client level handler
func (e *eventExecutor) RemoveClientHandler(domain string, t EventType, c EventCallback) {
	e.mu.Lock()
	defer e.mu.Unlock()

	_, ok := e.scopedRegistry[domain]
	if !ok {
		// nothing to remove
		return
	}

	entrySlice := e.scopedRegistry[domain].callbacks[t]
	if entrySlice == nil {
		// nothing to remove
		return
	}

	for i, f := range entrySlice {
		if f == c {
			entrySlice = append(entrySlice[:i], entrySlice[i+1:]...)
		}
	}

	e.scopedRegistry[domain].callbacks[t] = entrySlice
}

func (e *eventExecutor) GetAPIRegistry() map[EventType][]EventCallback {
	return e.apiRegistry
}

func (e *eventExecutor) GetClientRegistry(client string) scopedCallback {
	return e.scopedRegistry[client]
}

// emitOnRegistration fulfils the spec requirement to fire events if the
// event type and the state of the associated provider are compatible.
func (e *eventExecutor) emitOnRegistration(domain string, providerReference providerReference, eventType EventType, callback EventCallback) {
	state, ok := e.loadState(domain)
	if !ok {
		return
	}

	var message string
	if state == ReadyState && eventType == ProviderReady {
		message = "provider is in ready state"
	} else if state == ErrorState && eventType == ProviderError {
		message = "provider is in error state"
	} else if state == StaleState && eventType == ProviderStale {
		message = "provider is in stale state"
	}

	if message != "" {
		(*callback)(EventDetails{
			ProviderName: providerReference.featureProvider.Metadata().Name,
			ProviderEventDetails: ProviderEventDetails{
				Message: message,
			},
		})
	}
}

func (e *eventExecutor) loadState(domain string) (State, bool) {
	state, ok := e.states.Load(domain)
	if !ok {
		if state, ok = e.states.Load(defaultDomain); !ok {
			return NotReadyState, false
		}
	}
	return state.(State), true
}

func (e *eventExecutor) State(domain string) State {
	state, _ := e.loadState(domain)
	return state
}

// registerDefaultProvider registers the default FeatureProvider and remove the old default provider if available
func (e *eventExecutor) registerDefaultProvider(provider FeatureProvider) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	newProvider := newProviderRef(provider)
	oldProvider := e.defaultProviderReference
	e.defaultProviderReference = newProvider

	return e.startListeningAndShutdownOld(newProvider, oldProvider)
}

// registerNamedEventingProvider registers a named FeatureProvider and remove event listener for old named provider
func (e *eventExecutor) registerNamedEventingProvider(associatedClient string, provider FeatureProvider) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	newProvider := newProviderRef(provider)

	oldProvider := e.namedProviderReference[associatedClient]
	e.namedProviderReference[associatedClient] = newProvider

	return e.startListeningAndShutdownOld(newProvider, oldProvider)
}

// startListeningAndShutdownOld is a helper to start concurrent listening to new provider events and  invoke shutdown
// hook of the old provider if it's not bound by another subscription
func (e *eventExecutor) startListeningAndShutdownOld(newProvider providerReference, oldReference providerReference) error {

	// check if this provider already actively handled - 1:N binding capability
	if !isRunning(newProvider, e.activeSubscriptions) {
		e.activeSubscriptions = append(e.activeSubscriptions, newProvider)

		go func() {
			v, ok := newProvider.featureProvider.(EventHandler)
			if !ok {
				return
			}

			// event handling of the new feature provider
			for {
				select {
				case event := <-v.EventChannel():
					e.eventChan <- eventPayload{
						event:   event,
						handler: newProvider.featureProvider,
					}
				case <-newProvider.shutdownSemaphore:
					return
				}
			}
		}()
	}

	// shutdown old provider handling

	// check if this provider is still bound - 1:N binding capability
	if isBound(oldReference, e.defaultProviderReference, maps.Values(e.namedProviderReference)) {
		return nil
	}

	// drop from active references
	for i, r := range e.activeSubscriptions {
		if oldReference.equals(r) {
			e.activeSubscriptions = append(e.activeSubscriptions[:i], e.activeSubscriptions[i+1:]...)
		}
	}

	_, ok := oldReference.featureProvider.(EventHandler)
	if !ok {
		// no shutdown for non event handling provider
		return nil
	}

	// avoid shutdown lockouts
	select {
	case oldReference.shutdownSemaphore <- "":
		return nil
	case <-time.After(200 * time.Millisecond):
		return fmt.Errorf("old event handler %s timeout waiting for handler shutdown",
			oldReference.featureProvider.Metadata().Name)
	}
}

// startEventListener trigger the event listening of this executor
func (e *eventExecutor) startEventListener() {
	e.once.Do(func() {
		go func() {
			for payload := range e.eventChan {
				e.triggerEvent(payload.event, payload.handler)
			}
		}()
	})
}

// triggerEvent performs the actual event handling
func (e *eventExecutor) triggerEvent(event Event, handler FeatureProvider) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// first run API handlers
	for _, c := range e.apiRegistry[event.EventType] {
		e.executeHandler(*c, event)
	}

	// then run client handlers
	for domain, reference := range e.namedProviderReference {
		if !reference.equals(newProviderRef(handler)) {
			continue
		}

		e.states.Store(domain, stateFromEvent(event))
		for _, c := range e.scopedRegistry[domain].callbacks[event.EventType] {
			e.executeHandler(*c, event)
		}
	}

	if !e.defaultProviderReference.equals(newProviderRef(handler)) {
		return
	}

	// handling the default provider
	e.states.Store(defaultDomain, stateFromEvent(event))
	// invoke default provider bound (no provider associated) handlers by filtering
	for domain, registry := range e.scopedRegistry {
		if _, ok := e.namedProviderReference[domain]; ok {
			// association exist, skip and check next
			continue
		}

		for _, c := range registry.callbacks[event.EventType] {
			e.executeHandler(*c, event)
		}
	}

}

// executeHandler is a helper which performs the actual invocation of the callback
func (e *eventExecutor) executeHandler(f func(details EventDetails), event Event) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Info("recovered from a panic")
			}
		}()

		f(EventDetails{
			ProviderName: event.ProviderName,
			ProviderEventDetails: ProviderEventDetails{
				Message:       event.Message,
				FlagChanges:   event.FlagChanges,
				EventMetadata: event.EventMetadata,
			},
		})
	}()
}

// isRunning is a helper till we bump to the latest go version with slices.contains support
func isRunning(provider providerReference, activeProviders []providerReference) bool {
	for _, activeProvider := range activeProviders {
		if activeProvider.equals(provider) {
			return true
		}
	}
	return false
}

// isRunning is a helper to check if given provider is already in use
func isBound(provider providerReference, defaultProvider providerReference, namedProviders []providerReference) bool {
	if provider.equals(defaultProvider) {
		return true
	}

	for _, namedProvider := range namedProviders {
		if provider.equals(namedProvider) {
			return true
		}
	}
	return false
}
