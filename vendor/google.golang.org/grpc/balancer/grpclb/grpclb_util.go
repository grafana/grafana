/*
 *
 * Copyright 2016 gRPC authors.
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

package grpclb

import (
	"fmt"
	"sync"
	"time"

	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/resolver"
)

const subConnCacheTime = time.Second * 10

// lbCacheClientConn is a wrapper balancer.ClientConn with a SubConn cache.
// SubConns will be kept in cache for subConnCacheTime before being shut down.
//
// Its NewSubconn and SubConn.Shutdown methods are updated to do cache first.
type lbCacheClientConn struct {
	balancer.ClientConn

	timeout time.Duration

	mu sync.Mutex
	// subConnCache only keeps subConns that are being deleted.
	subConnCache  map[resolver.Address]*subConnCacheEntry
	subConnToAddr map[balancer.SubConn]resolver.Address
}

type subConnCacheEntry struct {
	sc balancer.SubConn

	cancel        func()
	abortDeleting bool
}

func newLBCacheClientConn(cc balancer.ClientConn) *lbCacheClientConn {
	return &lbCacheClientConn{
		ClientConn:    cc,
		timeout:       subConnCacheTime,
		subConnCache:  make(map[resolver.Address]*subConnCacheEntry),
		subConnToAddr: make(map[balancer.SubConn]resolver.Address),
	}
}

func (ccc *lbCacheClientConn) NewSubConn(addrs []resolver.Address, opts balancer.NewSubConnOptions) (balancer.SubConn, error) {
	if len(addrs) != 1 {
		return nil, fmt.Errorf("grpclb calling NewSubConn with addrs of length %v", len(addrs))
	}
	addrWithoutAttrs := addrs[0]
	addrWithoutAttrs.Attributes = nil

	ccc.mu.Lock()
	defer ccc.mu.Unlock()
	if entry, ok := ccc.subConnCache[addrWithoutAttrs]; ok {
		// If entry is in subConnCache, the SubConn was being deleted.
		// cancel function will never be nil.
		entry.cancel()
		delete(ccc.subConnCache, addrWithoutAttrs)
		return entry.sc, nil
	}

	scNew, err := ccc.ClientConn.NewSubConn(addrs, opts)
	if err != nil {
		return nil, err
	}
	scNew = &lbCacheSubConn{SubConn: scNew, ccc: ccc}

	ccc.subConnToAddr[scNew] = addrWithoutAttrs
	return scNew, nil
}

func (ccc *lbCacheClientConn) RemoveSubConn(sc balancer.SubConn) {
	logger.Errorf("RemoveSubConn(%v) called unexpectedly", sc)
}

type lbCacheSubConn struct {
	balancer.SubConn
	ccc *lbCacheClientConn
}

func (sc *lbCacheSubConn) Shutdown() {
	ccc := sc.ccc
	ccc.mu.Lock()
	defer ccc.mu.Unlock()
	addr, ok := ccc.subConnToAddr[sc]
	if !ok {
		return
	}

	if entry, ok := ccc.subConnCache[addr]; ok {
		if entry.sc != sc {
			// This could happen if NewSubConn was called multiple times for
			// the same address, and those SubConns are all shut down. We
			// remove sc immediately here.
			delete(ccc.subConnToAddr, sc)
			sc.SubConn.Shutdown()
		}
		return
	}

	entry := &subConnCacheEntry{
		sc: sc,
	}
	ccc.subConnCache[addr] = entry

	timer := time.AfterFunc(ccc.timeout, func() {
		ccc.mu.Lock()
		defer ccc.mu.Unlock()
		if entry.abortDeleting {
			return
		}
		sc.SubConn.Shutdown()
		delete(ccc.subConnToAddr, sc)
		delete(ccc.subConnCache, addr)
	})
	entry.cancel = func() {
		if !timer.Stop() {
			// If stop was not successful, the timer has fired (this can only
			// happen in a race). But the deleting function is blocked on ccc.mu
			// because the mutex was held by the caller of this function.
			//
			// Set abortDeleting to true to abort the deleting function. When
			// the lock is released, the deleting function will acquire the
			// lock, check the value of abortDeleting and return.
			entry.abortDeleting = true
		}
	}
}

func (ccc *lbCacheClientConn) UpdateState(s balancer.State) {
	s.Picker = &lbCachePicker{Picker: s.Picker}
	ccc.ClientConn.UpdateState(s)
}

func (ccc *lbCacheClientConn) close() {
	ccc.mu.Lock()
	defer ccc.mu.Unlock()
	// Only cancel all existing timers. There's no need to shut down SubConns.
	for _, entry := range ccc.subConnCache {
		entry.cancel()
	}
}

type lbCachePicker struct {
	balancer.Picker
}

func (cp *lbCachePicker) Pick(i balancer.PickInfo) (balancer.PickResult, error) {
	res, err := cp.Picker.Pick(i)
	if err != nil {
		return res, err
	}
	res.SubConn = res.SubConn.(*lbCacheSubConn).SubConn
	return res, nil
}
