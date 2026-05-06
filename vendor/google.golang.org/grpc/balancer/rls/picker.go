/*
 *
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package rls

import (
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/balancer/rls/internal/keys"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/connectivity"
	estats "google.golang.org/grpc/experimental/stats"
	internalgrpclog "google.golang.org/grpc/internal/grpclog"
	rlspb "google.golang.org/grpc/internal/proto/grpc_lookup_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var (
	errRLSThrottled = errors.New("RLS call throttled at client side")

	// Function to compute data cache entry size.
	computeDataCacheEntrySize = dcEntrySize
)

// exitIdler wraps the only method on the BalancerGroup that the picker calls.
type exitIdler interface {
	ExitIdleOne(id string)
}

// rlsPicker selects the subConn to be used for a particular RPC. It does not
// manage subConns directly and delegates to pickers provided by child policies.
type rlsPicker struct {
	// The keyBuilder map used to generate RLS keys for the RPC. This is built
	// by the LB policy based on the received ServiceConfig.
	kbm keys.BuilderMap
	// Endpoint from the user's original dial target. Used to set the `host_key`
	// field in `extra_keys`.
	origEndpoint string

	lb *rlsBalancer

	// The picker is given its own copy of the below fields from the RLS LB policy
	// to avoid having to grab the mutex on the latter.
	rlsServerTarget string
	grpcTarget      string
	metricsRecorder estats.MetricsRecorder
	defaultPolicy   *childPolicyWrapper // Child policy for the default target.
	ctrlCh          *controlChannel     // Control channel to the RLS server.
	maxAge          time.Duration       // Cache max age from LB config.
	staleAge        time.Duration       // Cache stale age from LB config.
	bg              exitIdler
	logger          *internalgrpclog.PrefixLogger
}

// isFullMethodNameValid return true if name is of the form `/service/method`.
func isFullMethodNameValid(name string) bool {
	return strings.HasPrefix(name, "/") && strings.Count(name, "/") == 2
}

// Pick makes the routing decision for every outbound RPC.
func (p *rlsPicker) Pick(info balancer.PickInfo) (balancer.PickResult, error) {
	if name := info.FullMethodName; !isFullMethodNameValid(name) {
		return balancer.PickResult{}, fmt.Errorf("rls: method name %q is not of the form '/service/method", name)
	}

	// Build the request's keys using the key builders from LB config.
	md, _ := metadata.FromOutgoingContext(info.Ctx)
	reqKeys := p.kbm.RLSKey(md, p.origEndpoint, info.FullMethodName)

	p.lb.cacheMu.Lock()
	var pr balancer.PickResult
	var err error

	// Record metrics without the cache mutex held, to prevent lock contention
	// between concurrent RPC's and their Pick calls. Metrics Recording can
	// potentially be expensive.
	metricsCallback := func() {}
	defer func() {
		p.lb.cacheMu.Unlock()
		metricsCallback()
	}()

	// Lookup data cache and pending request map using request path and keys.
	cacheKey := cacheKey{path: info.FullMethodName, keys: reqKeys.Str}
	dcEntry := p.lb.dataCache.getEntry(cacheKey)
	pendingEntry := p.lb.pendingMap[cacheKey]
	now := time.Now()

	switch {
	// No data cache entry. No pending request.
	case dcEntry == nil && pendingEntry == nil:
		throttled := p.sendRouteLookupRequestLocked(cacheKey, &backoffState{bs: defaultBackoffStrategy}, reqKeys.Map, rlspb.RouteLookupRequest_REASON_MISS, "")
		if throttled {
			pr, metricsCallback, err = p.useDefaultPickIfPossible(info, errRLSThrottled)
			return pr, err
		}
		return balancer.PickResult{}, balancer.ErrNoSubConnAvailable

	// No data cache entry. Pending request exits.
	case dcEntry == nil && pendingEntry != nil:
		return balancer.PickResult{}, balancer.ErrNoSubConnAvailable

	// Data cache hit. No pending request.
	case dcEntry != nil && pendingEntry == nil:
		if dcEntry.expiryTime.After(now) {
			if !dcEntry.staleTime.IsZero() && dcEntry.staleTime.Before(now) && dcEntry.backoffTime.Before(now) {
				p.sendRouteLookupRequestLocked(cacheKey, dcEntry.backoffState, reqKeys.Map, rlspb.RouteLookupRequest_REASON_STALE, dcEntry.headerData)
			}
			// Delegate to child policies.
			pr, metricsCallback, err = p.delegateToChildPoliciesLocked(dcEntry, info)
			return pr, err
		}

		// We get here only if the data cache entry has expired. If entry is in
		// backoff, delegate to default target or fail the pick.
		if dcEntry.backoffState != nil && dcEntry.backoffTime.After(now) {
			// Avoid propagating the status code received on control plane RPCs to the
			// data plane which can lead to unexpected outcomes as we do not control
			// the status code sent by the control plane. Propagating the status
			// message received from the control plane is still fine, as it could be
			// useful for debugging purposes.
			st := dcEntry.status
			pr, metricsCallback, err = p.useDefaultPickIfPossible(info, status.Error(codes.Unavailable, fmt.Sprintf("most recent error from RLS server: %v", st.Error())))
			return pr, err
		}

		// We get here only if the entry has expired and is not in backoff.
		throttled := p.sendRouteLookupRequestLocked(cacheKey, dcEntry.backoffState, reqKeys.Map, rlspb.RouteLookupRequest_REASON_MISS, "")
		if throttled {
			pr, metricsCallback, err = p.useDefaultPickIfPossible(info, errRLSThrottled)
			return pr, err
		}
		return balancer.PickResult{}, balancer.ErrNoSubConnAvailable

	// Data cache hit. Pending request exists.
	default:
		if dcEntry.expiryTime.After(now) {
			pr, metricsCallback, err = p.delegateToChildPoliciesLocked(dcEntry, info)
			return pr, err
		}
		// Data cache entry has expired and pending request exists. Queue pick.
		return balancer.PickResult{}, balancer.ErrNoSubConnAvailable
	}
}

// errToPickResult is a helper function which converts the error value returned
// by Pick() to a string that represents the pick result.
func errToPickResult(err error) string {
	if err == nil {
		return "complete"
	}
	if errors.Is(err, balancer.ErrNoSubConnAvailable) {
		return "queue"
	}
	if _, ok := status.FromError(err); ok {
		return "drop"
	}
	return "fail"
}

// delegateToChildPoliciesLocked is a helper function which iterates through the
// list of child policy wrappers in a cache entry and attempts to find a child
// policy to which this RPC can be routed to. If all child policies are in
// TRANSIENT_FAILURE, we delegate to the last child policy arbitrarily. Returns
// a function to be invoked to record metrics.
func (p *rlsPicker) delegateToChildPoliciesLocked(dcEntry *cacheEntry, info balancer.PickInfo) (balancer.PickResult, func(), error) {
	const rlsDataHeaderName = "x-google-rls-data"
	for i, cpw := range dcEntry.childPolicyWrappers {
		state := (*balancer.State)(atomic.LoadPointer(&cpw.state))
		// Delegate to the child policy if it is not in TRANSIENT_FAILURE, or if
		// it is the last one (which handles the case of delegating to the last
		// child picker if all child policies are in TRANSIENT_FAILURE).
		if state.ConnectivityState != connectivity.TransientFailure || i == len(dcEntry.childPolicyWrappers)-1 {
			// Any header data received from the RLS server is stored in the
			// cache entry and needs to be sent to the actual backend in the
			// X-Google-RLS-Data header.
			res, err := state.Picker.Pick(info)
			if err != nil {
				pr := errToPickResult(err)
				return res, func() {
					if pr == "queue" {
						// Don't record metrics for queued Picks.
						return
					}
					targetPicksMetric.Record(p.metricsRecorder, 1, p.grpcTarget, p.rlsServerTarget, cpw.target, pr)
				}, err
			}

			if res.Metadata == nil {
				res.Metadata = metadata.Pairs(rlsDataHeaderName, dcEntry.headerData)
			} else {
				res.Metadata.Append(rlsDataHeaderName, dcEntry.headerData)
			}
			return res, func() {
				targetPicksMetric.Record(p.metricsRecorder, 1, p.grpcTarget, p.rlsServerTarget, cpw.target, "complete")
			}, nil
		}
	}

	// In the unlikely event that we have a cache entry with no targets, we end up
	// queueing the RPC.
	return balancer.PickResult{}, func() {}, balancer.ErrNoSubConnAvailable
}

// useDefaultPickIfPossible is a helper method which delegates to the default
// target if one is configured, or fails the pick with the given error. Returns
// a function to be invoked to record metrics.
func (p *rlsPicker) useDefaultPickIfPossible(info balancer.PickInfo, errOnNoDefault error) (balancer.PickResult, func(), error) {
	if p.defaultPolicy != nil {
		state := (*balancer.State)(atomic.LoadPointer(&p.defaultPolicy.state))
		res, err := state.Picker.Pick(info)
		pr := errToPickResult(err)
		return res, func() {
			if pr == "queue" {
				// Don't record metrics for queued Picks.
				return
			}
			defaultTargetPicksMetric.Record(p.metricsRecorder, 1, p.grpcTarget, p.rlsServerTarget, p.defaultPolicy.target, pr)
		}, err
	}

	return balancer.PickResult{}, func() {
		failedPicksMetric.Record(p.metricsRecorder, 1, p.grpcTarget, p.rlsServerTarget)
	}, errOnNoDefault
}

// sendRouteLookupRequestLocked adds an entry to the pending request map and
// sends out an RLS request using the passed in arguments. Returns a value
// indicating if the request was throttled by the client-side adaptive
// throttler.
func (p *rlsPicker) sendRouteLookupRequestLocked(cacheKey cacheKey, bs *backoffState, reqKeys map[string]string, reason rlspb.RouteLookupRequest_Reason, staleHeaders string) bool {
	if p.lb.pendingMap[cacheKey] != nil {
		return false
	}

	p.lb.pendingMap[cacheKey] = bs
	throttled := p.ctrlCh.lookup(reqKeys, reason, staleHeaders, func(targets []string, headerData string, err error) {
		p.handleRouteLookupResponse(cacheKey, targets, headerData, err)
	})
	if throttled {
		delete(p.lb.pendingMap, cacheKey)
	}
	return throttled
}

// handleRouteLookupResponse is the callback invoked by the control channel upon
// receipt of an RLS response. Modifies the data cache and pending requests map
// and sends a new picker.
//
// Acquires the write-lock on the cache. Caller must not hold p.lb.cacheMu.
func (p *rlsPicker) handleRouteLookupResponse(cacheKey cacheKey, targets []string, headerData string, err error) {
	p.logger.Infof("Received RLS response for key %+v with targets %+v, headerData %q, err: %v", cacheKey, targets, headerData, err)

	p.lb.cacheMu.Lock()
	defer func() {
		// Pending request map entry is unconditionally deleted since the request is
		// no longer pending.
		p.logger.Infof("Removing pending request entry for key %+v", cacheKey)
		delete(p.lb.pendingMap, cacheKey)
		p.lb.sendNewPicker()
		p.lb.cacheMu.Unlock()
	}()

	// Lookup the data cache entry or create a new one.
	dcEntry := p.lb.dataCache.getEntry(cacheKey)
	if dcEntry == nil {
		dcEntry = &cacheEntry{}
		if _, ok := p.lb.dataCache.addEntry(cacheKey, dcEntry); !ok {
			// This is a very unlikely case where we are unable to add a
			// data cache entry. Log and leave.
			p.logger.Warningf("Failed to add data cache entry for %+v", cacheKey)
			return
		}
	}

	// For failed requests, the data cache entry is modified as follows:
	// - status is set to error returned from the control channel
	// - current backoff state is available in the pending entry
	//   - `retries` field is incremented and
	//   - backoff state is moved to the data cache
	// - backoffTime is set to the time indicated by the backoff state
	// - backoffExpirationTime is set to twice the backoff time
	// - backoffTimer is set to fire after backoffTime
	//
	// When a proactive cache refresh fails, this would leave the targets and the
	// expiry time from the old entry unchanged. And this mean that the old valid
	// entry would be used until expiration, and a new picker would be sent upon
	// backoff expiry.
	now := time.Now()

	// "An RLS request is considered to have failed if it returns a non-OK
	// status or the RLS response's targets list is non-empty." - RLS LB Policy
	// design.
	if len(targets) == 0 && err == nil {
		err = fmt.Errorf("RLS response's target list does not contain any entries for key %+v", cacheKey)
		// If err is set, rpc error from the control plane and no control plane
		// configuration is why no targets were passed into this helper, no need
		// to specify and tell the user this information.
	}
	if err != nil {
		dcEntry.status = err
		pendingEntry := p.lb.pendingMap[cacheKey]
		pendingEntry.retries++
		backoffTime := pendingEntry.bs.Backoff(pendingEntry.retries)
		dcEntry.backoffState = pendingEntry
		dcEntry.backoffTime = now.Add(backoffTime)
		dcEntry.backoffExpiryTime = now.Add(2 * backoffTime)
		if dcEntry.backoffState.timer != nil {
			dcEntry.backoffState.timer.Stop()
		}
		dcEntry.backoffState.timer = time.AfterFunc(backoffTime, p.lb.sendNewPicker)
		return
	}

	// For successful requests, the cache entry is modified as follows:
	// - childPolicyWrappers is set to point to the child policy wrappers
	//   associated with the targets specified in the received response
	// - headerData is set to the value received in the response
	// - expiryTime, stateTime and earliestEvictionTime are set
	// - status is set to nil (OK status)
	// - backoff state is cleared
	p.setChildPolicyWrappersInCacheEntry(dcEntry, targets)
	dcEntry.headerData = headerData
	dcEntry.expiryTime = now.Add(p.maxAge)
	if p.staleAge != 0 {
		dcEntry.staleTime = now.Add(p.staleAge)
	}
	dcEntry.earliestEvictTime = now.Add(minEvictDuration)
	dcEntry.status = nil
	dcEntry.backoffState = &backoffState{bs: defaultBackoffStrategy}
	dcEntry.backoffTime = time.Time{}
	dcEntry.backoffExpiryTime = time.Time{}
	p.lb.dataCache.updateEntrySize(dcEntry, computeDataCacheEntrySize(cacheKey, dcEntry))
}

// setChildPolicyWrappersInCacheEntry sets up the childPolicyWrappers field in
// the cache entry to point to the child policy wrappers for the targets
// specified in the RLS response.
//
// Caller must hold a write-lock on p.lb.cacheMu.
func (p *rlsPicker) setChildPolicyWrappersInCacheEntry(dcEntry *cacheEntry, newTargets []string) {
	// If the childPolicyWrappers field is already pointing to the right targets,
	// then the field's value does not need to change.
	targetsChanged := true
	func() {
		if cpws := dcEntry.childPolicyWrappers; cpws != nil {
			if len(newTargets) != len(cpws) {
				return
			}
			for i, target := range newTargets {
				if cpws[i].target != target {
					return
				}
			}
			targetsChanged = false
		}
	}()
	if !targetsChanged {
		return
	}

	// If the childPolicyWrappers field is not already set to the right targets,
	// then it must be reset. We construct a new list of child policies and
	// then swap out the old list for the new one.
	newChildPolicies := p.lb.acquireChildPolicyReferences(newTargets)
	oldChildPolicyTargets := make([]string, len(dcEntry.childPolicyWrappers))
	for i, cpw := range dcEntry.childPolicyWrappers {
		oldChildPolicyTargets[i] = cpw.target
	}
	p.lb.releaseChildPolicyReferences(oldChildPolicyTargets)
	dcEntry.childPolicyWrappers = newChildPolicies
}

func dcEntrySize(key cacheKey, entry *cacheEntry) int64 {
	return int64(len(key.path) + len(key.keys) + len(entry.headerData))
}
