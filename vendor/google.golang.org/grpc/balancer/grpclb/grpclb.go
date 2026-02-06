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

// Package grpclb defines a grpclb balancer.
//
// To install grpclb balancer, import this package as:
//
//	import _ "google.golang.org/grpc/balancer/grpclb"
package grpclb

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/balancer/base"
	grpclbstate "google.golang.org/grpc/balancer/grpclb/state"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/internal"
	"google.golang.org/grpc/internal/backoff"
	internalgrpclog "google.golang.org/grpc/internal/grpclog"
	"google.golang.org/grpc/internal/pretty"
	"google.golang.org/grpc/internal/resolver/dns"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/resolver/manual"
	"google.golang.org/protobuf/types/known/durationpb"

	lbpb "google.golang.org/grpc/balancer/grpclb/grpc_lb_v1"
)

const (
	lbTokenKey             = "lb-token"
	defaultFallbackTimeout = 10 * time.Second
	grpclbName             = "grpclb"
)

var errServerTerminatedConnection = errors.New("grpclb: failed to recv server list: server terminated connection")
var logger = grpclog.Component("grpclb")

func convertDuration(d *durationpb.Duration) time.Duration {
	if d == nil {
		return 0
	}
	return time.Duration(d.Seconds)*time.Second + time.Duration(d.Nanos)*time.Nanosecond
}

// Client API for LoadBalancer service.
// Mostly copied from generated pb.go file.
// To avoid circular dependency.
type loadBalancerClient struct {
	cc *grpc.ClientConn
}

func (c *loadBalancerClient) BalanceLoad(ctx context.Context, opts ...grpc.CallOption) (*balanceLoadClientStream, error) {
	desc := &grpc.StreamDesc{
		StreamName:    "BalanceLoad",
		ServerStreams: true,
		ClientStreams: true,
	}
	stream, err := c.cc.NewStream(ctx, desc, "/grpc.lb.v1.LoadBalancer/BalanceLoad", opts...)
	if err != nil {
		return nil, err
	}
	x := &balanceLoadClientStream{stream}
	return x, nil
}

type balanceLoadClientStream struct {
	grpc.ClientStream
}

func (x *balanceLoadClientStream) Send(m *lbpb.LoadBalanceRequest) error {
	return x.ClientStream.SendMsg(m)
}

func (x *balanceLoadClientStream) Recv() (*lbpb.LoadBalanceResponse, error) {
	m := new(lbpb.LoadBalanceResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func init() {
	balancer.Register(newLBBuilder())
	dns.EnableSRVLookups = true
}

// newLBBuilder creates a builder for grpclb.
func newLBBuilder() balancer.Builder {
	return newLBBuilderWithFallbackTimeout(defaultFallbackTimeout)
}

// newLBBuilderWithFallbackTimeout creates a grpclb builder with the given
// fallbackTimeout. If no response is received from the remote balancer within
// fallbackTimeout, the backend addresses from the resolved address list will be
// used.
//
// Only call this function when a non-default fallback timeout is needed.
func newLBBuilderWithFallbackTimeout(fallbackTimeout time.Duration) balancer.Builder {
	return &lbBuilder{
		fallbackTimeout: fallbackTimeout,
	}
}

type lbBuilder struct {
	fallbackTimeout time.Duration
}

func (b *lbBuilder) Name() string {
	return grpclbName
}

func (b *lbBuilder) Build(cc balancer.ClientConn, opt balancer.BuildOptions) balancer.Balancer {
	// This generates a manual resolver builder with a fixed scheme. This
	// scheme will be used to dial to remote LB, so we can send filtered
	// address updates to remote LB ClientConn using this manual resolver.
	mr := manual.NewBuilderWithScheme("grpclb-internal")
	// ResolveNow() on this manual resolver is forwarded to the parent
	// ClientConn, so when grpclb client loses contact with the remote balancer,
	// the parent ClientConn's resolver will re-resolve.
	mr.ResolveNowCallback = cc.ResolveNow

	lb := &lbBalancer{
		cc:              newLBCacheClientConn(cc),
		dialTarget:      opt.Target.Endpoint(),
		target:          opt.Target.Endpoint(),
		opt:             opt,
		fallbackTimeout: b.fallbackTimeout,
		doneCh:          make(chan struct{}),

		manualResolver: mr,
		subConns:       make(map[resolver.Address]balancer.SubConn),
		scStates:       make(map[balancer.SubConn]connectivity.State),
		picker:         base.NewErrPicker(balancer.ErrNoSubConnAvailable),
		clientStats:    newRPCStats(),
		backoff:        backoff.DefaultExponential, // TODO: make backoff configurable.
	}
	lb.logger = internalgrpclog.NewPrefixLogger(logger, fmt.Sprintf("[grpclb %p] ", lb))

	var err error
	if opt.CredsBundle != nil {
		lb.grpclbClientConnCreds, err = opt.CredsBundle.NewWithMode(internal.CredsBundleModeBalancer)
		if err != nil {
			lb.logger.Warningf("Failed to create credentials used for connecting to grpclb: %v", err)
		}
		lb.grpclbBackendCreds, err = opt.CredsBundle.NewWithMode(internal.CredsBundleModeBackendFromBalancer)
		if err != nil {
			lb.logger.Warningf("Failed to create credentials used for connecting to backends returned by grpclb: %v", err)
		}
	}

	return lb
}

type lbBalancer struct {
	cc         *lbCacheClientConn
	dialTarget string // user's dial target
	target     string // same as dialTarget unless overridden in service config
	opt        balancer.BuildOptions
	logger     *internalgrpclog.PrefixLogger

	usePickFirst bool

	// grpclbClientConnCreds is the creds bundle to be used to connect to grpclb
	// servers. If it's nil, use the TransportCredentials from BuildOptions
	// instead.
	grpclbClientConnCreds credentials.Bundle
	// grpclbBackendCreds is the creds bundle to be used for addresses that are
	// returned by grpclb server. If it's nil, don't set anything when creating
	// SubConns.
	grpclbBackendCreds credentials.Bundle

	fallbackTimeout time.Duration
	doneCh          chan struct{}

	// manualResolver is used in the remote LB ClientConn inside grpclb. When
	// resolved address updates are received by grpclb, filtered updates will be
	// sent to remote LB ClientConn through this resolver.
	manualResolver *manual.Resolver
	// The ClientConn to talk to the remote balancer.
	ccRemoteLB *remoteBalancerCCWrapper
	// backoff for calling remote balancer.
	backoff backoff.Strategy

	// Support client side load reporting. Each picker gets a reference to this,
	// and will update its content.
	clientStats *rpcStats

	mu sync.Mutex // guards everything following.
	// The full server list including drops, used to check if the newly received
	// serverList contains anything new. Each generate picker will also have
	// reference to this list to do the first layer pick.
	fullServerList []*lbpb.Server
	// Backend addresses. It's kept so the addresses are available when
	// switching between round_robin and pickfirst.
	backendAddrs []resolver.Address
	// All backends addresses, with metadata set to nil. This list contains all
	// backend addresses in the same order and with the same duplicates as in
	// serverlist. When generating picker, a SubConn slice with the same order
	// but with only READY SCs will be generated.
	backendAddrsWithoutMetadata []resolver.Address
	// Roundrobin functionalities.
	state    connectivity.State
	subConns map[resolver.Address]balancer.SubConn   // Used to new/shutdown SubConn.
	scStates map[balancer.SubConn]connectivity.State // Used to filter READY SubConns.
	picker   balancer.Picker
	// Support fallback to resolved backend addresses if there's no response
	// from remote balancer within fallbackTimeout.
	remoteBalancerConnected bool
	serverListReceived      bool
	inFallback              bool
	// resolvedBackendAddrs is resolvedAddrs minus remote balancers. It's set
	// when resolved address updates are received, and read in the goroutine
	// handling fallback.
	resolvedBackendAddrs []resolver.Address
	connErr              error // the last connection error
}

// regeneratePicker takes a snapshot of the balancer, and generates a picker from
// it. The picker
//   - always returns ErrTransientFailure if the balancer is in TransientFailure,
//   - does two layer roundrobin pick otherwise.
//
// Caller must hold lb.mu.
func (lb *lbBalancer) regeneratePicker(resetDrop bool) {
	if lb.state == connectivity.TransientFailure {
		lb.picker = base.NewErrPicker(fmt.Errorf("all SubConns are in TransientFailure, last connection error: %v", lb.connErr))
		return
	}

	if lb.state == connectivity.Connecting {
		lb.picker = base.NewErrPicker(balancer.ErrNoSubConnAvailable)
		return
	}

	var readySCs []balancer.SubConn
	if lb.usePickFirst {
		for _, sc := range lb.subConns {
			readySCs = append(readySCs, sc)
			break
		}
	} else {
		for _, a := range lb.backendAddrsWithoutMetadata {
			if sc, ok := lb.subConns[a]; ok {
				if st, ok := lb.scStates[sc]; ok && st == connectivity.Ready {
					readySCs = append(readySCs, sc)
				}
			}
		}
	}

	if len(readySCs) <= 0 {
		// If there's no ready SubConns, always re-pick. This is to avoid drops
		// unless at least one SubConn is ready. Otherwise we may drop more
		// often than want because of drops + re-picks(which become re-drops).
		//
		// This doesn't seem to be necessary after the connecting check above.
		// Kept for safety.
		lb.picker = base.NewErrPicker(balancer.ErrNoSubConnAvailable)
		return
	}
	if lb.inFallback {
		lb.picker = newRRPicker(readySCs)
		return
	}
	if resetDrop {
		lb.picker = newLBPicker(lb.fullServerList, readySCs, lb.clientStats)
		return
	}
	prevLBPicker, ok := lb.picker.(*lbPicker)
	if !ok {
		lb.picker = newLBPicker(lb.fullServerList, readySCs, lb.clientStats)
		return
	}
	prevLBPicker.updateReadySCs(readySCs)
}

// aggregateSubConnStats calculate the aggregated state of SubConns in
// lb.SubConns. These SubConns are subconns in use (when switching between
// fallback and grpclb). lb.scState contains states for all SubConns, including
// those in cache (SubConns are cached for 10 seconds after shutdown).
//
//	The aggregated state is:
//	- If at least one SubConn in Ready, the aggregated state is Ready;
//	- Else if at least one SubConn in Connecting or IDLE, the aggregated state is Connecting;
//	  - It's OK to consider IDLE as Connecting. SubConns never stay in IDLE,
//	    they start to connect immediately. But there's a race between the overall
//	    state is reported, and when the new SubConn state arrives. And SubConns
//	    never go back to IDLE.
//	- Else the aggregated state is TransientFailure.
func (lb *lbBalancer) aggregateSubConnStates() connectivity.State {
	var numConnecting uint64

	for _, sc := range lb.subConns {
		if state, ok := lb.scStates[sc]; ok {
			switch state {
			case connectivity.Ready:
				return connectivity.Ready
			case connectivity.Connecting, connectivity.Idle:
				numConnecting++
			}
		}
	}
	if numConnecting > 0 {
		return connectivity.Connecting
	}
	return connectivity.TransientFailure
}

// UpdateSubConnState is unused; NewSubConn's options always specifies
// updateSubConnState as the listener.
func (lb *lbBalancer) UpdateSubConnState(sc balancer.SubConn, scs balancer.SubConnState) {
	lb.logger.Errorf("UpdateSubConnState(%v, %+v) called unexpectedly", sc, scs)
}

func (lb *lbBalancer) updateSubConnState(sc balancer.SubConn, scs balancer.SubConnState) {
	s := scs.ConnectivityState
	if lb.logger.V(2) {
		lb.logger.Infof("SubConn state change: %p, %v", sc, s)
	}
	lb.mu.Lock()
	defer lb.mu.Unlock()

	oldS, ok := lb.scStates[sc]
	if !ok {
		if lb.logger.V(2) {
			lb.logger.Infof("Received state change for an unknown SubConn: %p, %v", sc, s)
		}
		return
	}
	lb.scStates[sc] = s
	switch s {
	case connectivity.Idle:
		sc.Connect()
	case connectivity.Shutdown:
		// When an address was removed by resolver, b called Shutdown but kept
		// the sc's state in scStates. Remove state for this sc here.
		delete(lb.scStates, sc)
	case connectivity.TransientFailure:
		lb.connErr = scs.ConnectionError
	}
	// Force regenerate picker if
	//  - this sc became ready from not-ready
	//  - this sc became not-ready from ready
	lb.updateStateAndPicker((oldS == connectivity.Ready) != (s == connectivity.Ready), false)

	// Enter fallback when the aggregated state is not Ready and the connection
	// to remote balancer is lost.
	if lb.state != connectivity.Ready {
		if !lb.inFallback && !lb.remoteBalancerConnected {
			// Enter fallback.
			lb.refreshSubConns(lb.resolvedBackendAddrs, true, lb.usePickFirst)
		}
	}
}

// updateStateAndPicker re-calculate the aggregated state, and regenerate picker
// if overall state is changed.
//
// If forceRegeneratePicker is true, picker will be regenerated.
func (lb *lbBalancer) updateStateAndPicker(forceRegeneratePicker bool, resetDrop bool) {
	oldAggrState := lb.state
	lb.state = lb.aggregateSubConnStates()
	// Regenerate picker when one of the following happens:
	//  - caller wants to regenerate
	//  - the aggregated state changed
	if forceRegeneratePicker || (lb.state != oldAggrState) {
		lb.regeneratePicker(resetDrop)
	}
	var cc balancer.ClientConn = lb.cc
	if lb.usePickFirst {
		// Bypass the caching layer that would wrap the picker.
		cc = lb.cc.ClientConn
	}

	cc.UpdateState(balancer.State{ConnectivityState: lb.state, Picker: lb.picker})
}

// fallbackToBackendsAfter blocks for fallbackTimeout and falls back to use
// resolved backends (backends received from resolver, not from remote balancer)
// if no connection to remote balancers was successful.
func (lb *lbBalancer) fallbackToBackendsAfter(fallbackTimeout time.Duration) {
	timer := time.NewTimer(fallbackTimeout)
	defer timer.Stop()
	select {
	case <-timer.C:
	case <-lb.doneCh:
		return
	}
	lb.mu.Lock()
	if lb.inFallback || lb.serverListReceived {
		lb.mu.Unlock()
		return
	}
	// Enter fallback.
	lb.refreshSubConns(lb.resolvedBackendAddrs, true, lb.usePickFirst)
	lb.mu.Unlock()
}

func (lb *lbBalancer) handleServiceConfig(gc *grpclbServiceConfig) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	// grpclb uses the user's dial target to populate the `Name` field of the
	// `InitialLoadBalanceRequest` message sent to the remote balancer. But when
	// grpclb is used a child policy in the context of RLS, we want the `Name`
	// field to be populated with the value received from the RLS server. To
	// support this use case, an optional "target_name" field has been added to
	// the grpclb LB policy's config.  If specified, it overrides the name of
	// the target to be sent to the remote balancer; if not, the target to be
	// sent to the balancer will continue to be obtained from the target URI
	// passed to the gRPC client channel. Whenever that target to be sent to the
	// balancer is updated, we need to restart the stream to the balancer as
	// this target is sent in the first message on the stream.
	if gc != nil {
		target := lb.dialTarget
		if gc.ServiceName != "" {
			target = gc.ServiceName
		}
		if target != lb.target {
			lb.target = target
			if lb.ccRemoteLB != nil {
				lb.ccRemoteLB.cancelRemoteBalancerCall()
			}
		}
	}

	newUsePickFirst := childIsPickFirst(gc)
	if lb.usePickFirst == newUsePickFirst {
		return
	}
	if lb.logger.V(2) {
		lb.logger.Infof("Switching mode. Is pick_first used for backends? %v", newUsePickFirst)
	}
	lb.refreshSubConns(lb.backendAddrs, lb.inFallback, newUsePickFirst)
}

func (lb *lbBalancer) ResolverError(error) {
	// Ignore resolver errors.  GRPCLB is not selected unless the resolver
	// works at least once.
}

func (lb *lbBalancer) UpdateClientConnState(ccs balancer.ClientConnState) error {
	if lb.logger.V(2) {
		lb.logger.Infof("UpdateClientConnState: %s", pretty.ToJSON(ccs))
	}
	gc, _ := ccs.BalancerConfig.(*grpclbServiceConfig)
	lb.handleServiceConfig(gc)

	backendAddrs := ccs.ResolverState.Addresses

	var remoteBalancerAddrs []resolver.Address
	if sd := grpclbstate.Get(ccs.ResolverState); sd != nil {
		// Override any balancer addresses provided via
		// ccs.ResolverState.Addresses.
		remoteBalancerAddrs = sd.BalancerAddresses
	}

	if len(backendAddrs)+len(remoteBalancerAddrs) == 0 {
		// There should be at least one address, either grpclb server or
		// fallback. Empty address is not valid.
		return balancer.ErrBadResolverState
	}

	if len(remoteBalancerAddrs) == 0 {
		if lb.ccRemoteLB != nil {
			lb.ccRemoteLB.close()
			lb.ccRemoteLB = nil
		}
	} else if lb.ccRemoteLB == nil {
		// First time receiving resolved addresses, create a cc to remote
		// balancers.
		if err := lb.newRemoteBalancerCCWrapper(); err != nil {
			return err
		}
		// Start the fallback goroutine.
		go lb.fallbackToBackendsAfter(lb.fallbackTimeout)
	}

	if lb.ccRemoteLB != nil {
		// cc to remote balancers uses lb.manualResolver. Send the updated remote
		// balancer addresses to it through manualResolver.
		lb.manualResolver.UpdateState(resolver.State{Addresses: remoteBalancerAddrs})
	}

	lb.mu.Lock()
	lb.resolvedBackendAddrs = backendAddrs
	if len(remoteBalancerAddrs) == 0 || lb.inFallback {
		// If there's no remote balancer address in ClientConn update, grpclb
		// enters fallback mode immediately.
		//
		// If a new update is received while grpclb is in fallback, update the
		// list of backends being used to the new fallback backends.
		lb.refreshSubConns(lb.resolvedBackendAddrs, true, lb.usePickFirst)
	}
	lb.mu.Unlock()
	return nil
}

func (lb *lbBalancer) Close() {
	select {
	case <-lb.doneCh:
		return
	default:
	}
	close(lb.doneCh)
	if lb.ccRemoteLB != nil {
		lb.ccRemoteLB.close()
	}
	lb.cc.close()
}

func (lb *lbBalancer) ExitIdle() {}
