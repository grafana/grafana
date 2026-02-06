//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package temporal

import (
	"sync"
	"time"
)

// backoff sets a minimum wait time between eager update attempts. It's a variable so tests can manipulate it.
var backoff = func(now, lastAttempt time.Time) bool {
	return lastAttempt.Add(30 * time.Second).After(now)
}

// AcquireResource abstracts a method for refreshing a temporal resource.
type AcquireResource[TResource, TState any] func(state TState) (newResource TResource, newExpiration time.Time, err error)

// ShouldRefresh abstracts a method for indicating whether a resource should be refreshed before expiration.
type ShouldRefresh[TResource, TState any] func(TResource, TState) bool

// Resource is a temporal resource (usually a credential) that requires periodic refreshing.
type Resource[TResource, TState any] struct {
	// cond is used to synchronize access to the shared resource embodied by the remaining fields
	cond *sync.Cond

	// acquiring indicates that some thread/goroutine is in the process of acquiring/updating the resource
	acquiring bool

	// resource contains the value of the shared resource
	resource TResource

	// expiration indicates when the shared resource expires; it is 0 if the resource was never acquired
	expiration time.Time

	// lastAttempt indicates when a thread/goroutine last attempted to acquire/update the resource
	lastAttempt time.Time

	// shouldRefresh indicates whether the resource should be refreshed before expiration
	shouldRefresh ShouldRefresh[TResource, TState]

	// acquireResource is the callback function that actually acquires the resource
	acquireResource AcquireResource[TResource, TState]
}

// NewResource creates a new Resource that uses the specified AcquireResource for refreshing.
func NewResource[TResource, TState any](ar AcquireResource[TResource, TState]) *Resource[TResource, TState] {
	r := &Resource[TResource, TState]{acquireResource: ar, cond: sync.NewCond(&sync.Mutex{})}
	r.shouldRefresh = r.expiringSoon
	return r
}

// ResourceOptions contains optional configuration for Resource
type ResourceOptions[TResource, TState any] struct {
	// ShouldRefresh indicates whether [Resource.Get] should acquire an updated resource despite
	// the currently held resource not having expired. [Resource.Get] ignores all errors from
	// refresh attempts triggered by ShouldRefresh returning true, and doesn't call ShouldRefresh
	// when the resource has expired (it unconditionally updates expired resources). When
	// ShouldRefresh is nil, [Resource.Get] refreshes the resource if it will expire within 5
	// minutes.
	ShouldRefresh ShouldRefresh[TResource, TState]
}

// NewResourceWithOptions creates a new Resource that uses the specified AcquireResource for refreshing.
func NewResourceWithOptions[TResource, TState any](ar AcquireResource[TResource, TState], opts ResourceOptions[TResource, TState]) *Resource[TResource, TState] {
	r := NewResource(ar)
	if opts.ShouldRefresh != nil {
		r.shouldRefresh = opts.ShouldRefresh
	}
	return r
}

// Get returns the underlying resource.
// If the resource is fresh, no refresh is performed.
func (er *Resource[TResource, TState]) Get(state TState) (TResource, error) {
	now, acquire, expired := time.Now(), false, false

	// acquire exclusive lock
	er.cond.L.Lock()
	resource := er.resource

	for {
		expired = er.expiration.IsZero() || er.expiration.Before(now)
		if expired {
			// The resource was never acquired or has expired
			if !er.acquiring {
				// If another thread/goroutine is not acquiring/updating the resource, this thread/goroutine will do it
				er.acquiring, acquire = true, true
				break
			}
			// Getting here means that this thread/goroutine will wait for the updated resource
		} else if er.shouldRefresh(resource, state) {
			if !(er.acquiring || backoff(now, er.lastAttempt)) {
				// If another thread/goroutine is not acquiring/renewing the resource, and none has attempted
				// to do so within the last 30 seconds, this thread/goroutine will do it
				er.acquiring, acquire = true, true
				break
			}
			// This thread/goroutine will use the existing resource value while another updates it
			resource = er.resource
			break
		} else {
			// The resource is not close to expiring, this thread/goroutine should use its current value
			resource = er.resource
			break
		}
		// If we get here, wait for the new resource value to be acquired/updated
		er.cond.Wait()
	}
	er.cond.L.Unlock() // Release the lock so no threads/goroutines are blocked

	var err error
	if acquire {
		// This thread/goroutine has been selected to acquire/update the resource
		var expiration time.Time
		var newValue TResource
		er.lastAttempt = now
		newValue, expiration, err = er.acquireResource(state)

		// Atomically, update the shared resource's new value & expiration.
		er.cond.L.Lock()
		if err == nil {
			// Update resource & expiration, return the new value
			resource = newValue
			er.resource, er.expiration = resource, expiration
		} else if !expired {
			// An eager update failed. Discard the error and return the current--still valid--resource value
			err = nil
		}
		er.acquiring = false // Indicate that no thread/goroutine is currently acquiring the resource

		// Wake up any waiting threads/goroutines since there is a resource they can ALL use
		er.cond.L.Unlock()
		er.cond.Broadcast()
	}
	return resource, err // Return the resource this thread/goroutine can use
}

// Expire marks the resource as expired, ensuring it's refreshed on the next call to Get().
func (er *Resource[TResource, TState]) Expire() {
	er.cond.L.Lock()
	defer er.cond.L.Unlock()

	// Reset the expiration as if we never got this resource to begin with
	er.expiration = time.Time{}
}

func (er *Resource[TResource, TState]) expiringSoon(TResource, TState) bool {
	// call time.Now() instead of using Get's value so ShouldRefresh doesn't need a time.Time parameter
	return er.expiration.Add(-5 * time.Minute).Before(time.Now())
}
