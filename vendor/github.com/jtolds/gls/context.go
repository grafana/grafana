// Package gls implements goroutine-local storage.
package gls

import (
	"runtime"
	"sync"
)

const (
	maxCallers = 64
)

var (
	stackTagPool   = &idPool{}
	mgrRegistry    = make(map[*ContextManager]bool)
	mgrRegistryMtx sync.RWMutex
)

// Values is simply a map of key types to value types. Used by SetValues to
// set multiple values at once.
type Values map[interface{}]interface{}

func currentStack(skip int) []uintptr {
	stack := make([]uintptr, maxCallers)
	return stack[:runtime.Callers(2+skip, stack)]
}

// ContextManager is the main entrypoint for interacting with
// Goroutine-local-storage. You can have multiple independent ContextManagers
// at any given time. ContextManagers are usually declared globally for a given
// class of context variables. You should use NewContextManager for
// construction.
type ContextManager struct {
	mtx    sync.RWMutex
	values map[uint]Values
}

// NewContextManager returns a brand new ContextManager. It also registers the
// new ContextManager in the ContextManager registry which is used by the Go
// method. ContextManagers are typically defined globally at package scope.
func NewContextManager() *ContextManager {
	mgr := &ContextManager{values: make(map[uint]Values)}
	mgrRegistryMtx.Lock()
	defer mgrRegistryMtx.Unlock()
	mgrRegistry[mgr] = true
	return mgr
}

// Unregister removes a ContextManager from the global registry, used by the
// Go method. Only intended for use when you're completely done with a
// ContextManager. Use of Unregister at all is rare.
func (m *ContextManager) Unregister() {
	mgrRegistryMtx.Lock()
	defer mgrRegistryMtx.Unlock()
	delete(mgrRegistry, m)
}

// SetValues takes a collection of values and a function to call for those
// values to be set in. Anything further down the stack will have the set
// values available through GetValue. SetValues will add new values or replace
// existing values of the same key and will not mutate or change values for
// previous stack frames.
// SetValues is slow (makes a copy of all current and new values for the new
// gls-context) in order to reduce the amount of lookups GetValue requires.
func (m *ContextManager) SetValues(new_values Values, context_call func()) {
	if len(new_values) == 0 {
		context_call()
		return
	}

	tags := readStackTags(currentStack(1))

	m.mtx.Lock()
	values := new_values
	for _, tag := range tags {
		if existing_values, ok := m.values[tag]; ok {
			// oh, we found existing values, let's make a copy
			values = make(Values, len(existing_values)+len(new_values))
			for key, val := range existing_values {
				values[key] = val
			}
			for key, val := range new_values {
				values[key] = val
			}
			break
		}
	}
	new_tag := stackTagPool.Acquire()
	m.values[new_tag] = values
	m.mtx.Unlock()
	defer func() {
		m.mtx.Lock()
		delete(m.values, new_tag)
		m.mtx.Unlock()
		stackTagPool.Release(new_tag)
	}()

	addStackTag(new_tag, context_call)
}

// GetValue will return a previously set value, provided that the value was set
// by SetValues somewhere higher up the stack. If the value is not found, ok
// will be false.
func (m *ContextManager) GetValue(key interface{}) (value interface{}, ok bool) {

	tags := readStackTags(currentStack(1))
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	for _, tag := range tags {
		if values, ok := m.values[tag]; ok {
			value, ok := values[key]
			return value, ok
		}
	}
	return "", false
}

func (m *ContextManager) getValues() Values {
	tags := readStackTags(currentStack(2))
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	for _, tag := range tags {
		if values, ok := m.values[tag]; ok {
			return values
		}
	}
	return nil
}

// Go preserves ContextManager values and Goroutine-local-storage across new
// goroutine invocations. The Go method makes a copy of all existing values on
// all registered context managers and makes sure they are still set after
// kicking off the provided function in a new goroutine. If you don't use this
// Go method instead of the standard 'go' keyword, you will lose values in
// ContextManagers, as goroutines have brand new stacks.
func Go(cb func()) {
	mgrRegistryMtx.RLock()
	defer mgrRegistryMtx.RUnlock()

	for mgr, _ := range mgrRegistry {
		values := mgr.getValues()
		if len(values) > 0 {
			mgr_copy := mgr
			cb_copy := cb
			cb = func() { mgr_copy.SetValues(values, cb_copy) }
		}
	}

	go cb()
}
