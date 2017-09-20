/*
 *
 * Copyright 2017 gRPC authors.
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

package grpc

import (
	"sync"

	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/resolver"
)

// TODO(bar) move ClientConn methods to clientConn file.

func (cc *ClientConn) updatePicker(p balancer.Picker) {
	// TODO(bar) add a goroutine and sync it.
	// TODO(bar) implement blocking behavior and unblock the previous pick.
	cc.pmu.Lock()
	cc.picker = p
	cc.pmu.Unlock()
}

// ccBalancerWrapper is a wrapper on top of cc for balancers.
// It implements balancer.ClientConn interface.
type ccBalancerWrapper struct {
	cc *ClientConn
}

func (ccb *ccBalancerWrapper) NewSubConn(addrs []resolver.Address, opts balancer.NewSubConnOptions) (balancer.SubConn, error) {
	grpclog.Infof("ccBalancerWrapper: new subconn: %v", addrs)
	ac, err := ccb.cc.newAddrConn(addrs)
	if err != nil {
		return nil, err
	}
	acbw := &acBalancerWrapper{ac: ac}
	ac.acbw = acbw
	return acbw, nil
}

func (ccb *ccBalancerWrapper) RemoveSubConn(sc balancer.SubConn) {
	grpclog.Infof("ccBalancerWrapper: removing subconn")
	acbw, ok := sc.(*acBalancerWrapper)
	if !ok {
		return
	}
	ccb.cc.removeAddrConn(acbw.getAddrConn(), errConnDrain)
}

func (ccb *ccBalancerWrapper) UpdateBalancerState(s connectivity.State, p balancer.Picker) {
	// TODO(bar) update cc connectivity state.
	ccb.cc.updatePicker(p)
}

func (ccb *ccBalancerWrapper) Target() string {
	return ccb.cc.target
}

// acBalancerWrapper is a wrapper on top of ac for balancers.
// It implements balancer.SubConn interface.
type acBalancerWrapper struct {
	mu sync.Mutex
	ac *addrConn
}

func (acbw *acBalancerWrapper) UpdateAddresses(addrs []resolver.Address) {
	grpclog.Infof("acBalancerWrapper: UpdateAddresses called with %v", addrs)
	acbw.mu.Lock()
	defer acbw.mu.Unlock()
	// TODO(bar) update the addresses or tearDown and create a new ac.
	if !acbw.ac.tryUpdateAddrs(addrs) {
		cc := acbw.ac.cc
		acbw.ac.mu.Lock()
		// Set old ac.acbw to nil so the states update will be ignored by balancer.
		acbw.ac.acbw = nil
		acbw.ac.mu.Unlock()
		acState := acbw.ac.getState()
		acbw.ac.tearDown(errConnDrain)

		if acState == connectivity.Shutdown {
			return
		}

		ac, err := cc.newAddrConn(addrs)
		if err != nil {
			grpclog.Warningf("acBalancerWrapper: UpdateAddresses: failed to newAddrConn: %v", err)
			return
		}
		acbw.ac = ac
		ac.acbw = acbw
		if acState != connectivity.Idle {
			ac.connect(false)
		}
	}
}

func (acbw *acBalancerWrapper) Connect() {
	acbw.mu.Lock()
	defer acbw.mu.Unlock()
	acbw.ac.connect(false)
}

func (acbw *acBalancerWrapper) getAddrConn() *addrConn {
	acbw.mu.Lock()
	defer acbw.mu.Unlock()
	return acbw.ac
}
