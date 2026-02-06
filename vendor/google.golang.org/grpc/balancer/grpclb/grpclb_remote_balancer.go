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

package grpclb

import (
	"context"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/internal/backoff"
	imetadata "google.golang.org/grpc/internal/metadata"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/resolver"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	lbpb "google.golang.org/grpc/balancer/grpclb/grpc_lb_v1"
)

func serverListEqual(a, b []*lbpb.Server) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		if !proto.Equal(a[i], b[i]) {
			return false
		}
	}
	return true
}

// processServerList updates balancer's internal state, create/remove SubConns
// and regenerates picker using the received serverList.
func (lb *lbBalancer) processServerList(l *lbpb.ServerList) {
	if lb.logger.V(2) {
		lb.logger.Infof("Processing server list: %#v", l)
	}
	lb.mu.Lock()
	defer lb.mu.Unlock()

	// Set serverListReceived to true so fallback will not take effect if it has
	// not hit timeout.
	lb.serverListReceived = true

	// If the new server list == old server list, do nothing.
	if serverListEqual(lb.fullServerList, l.Servers) {
		if lb.logger.V(2) {
			lb.logger.Infof("Ignoring new server list as it is the same as the previous one")
		}
		return
	}
	lb.fullServerList = l.Servers

	var backendAddrs []resolver.Address
	for i, s := range l.Servers {
		if s.Drop {
			continue
		}

		md := metadata.Pairs(lbTokenKey, s.LoadBalanceToken)
		ipStr := net.IP(s.IpAddress).String()
		addr := imetadata.Set(resolver.Address{Addr: net.JoinHostPort(ipStr, fmt.Sprintf("%d", s.Port))}, md)
		if lb.logger.V(2) {
			lb.logger.Infof("Server list entry:|%d|, ipStr:|%s|, port:|%d|, load balancer token:|%v|", i, ipStr, s.Port, s.LoadBalanceToken)
		}
		backendAddrs = append(backendAddrs, addr)
	}

	// Call refreshSubConns to create/remove SubConns.  If we are in fallback,
	// this is also exiting fallback.
	lb.refreshSubConns(backendAddrs, false, lb.usePickFirst)
}

// refreshSubConns creates/removes SubConns with backendAddrs, and refreshes
// balancer state and picker.
//
// Caller must hold lb.mu.
func (lb *lbBalancer) refreshSubConns(backendAddrs []resolver.Address, fallback bool, pickFirst bool) {
	opts := balancer.NewSubConnOptions{}
	if !fallback {
		opts.CredsBundle = lb.grpclbBackendCreds
	}

	lb.backendAddrs = backendAddrs
	lb.backendAddrsWithoutMetadata = nil

	fallbackModeChanged := lb.inFallback != fallback
	lb.inFallback = fallback
	if fallbackModeChanged && lb.inFallback {
		// Clear previous received list when entering fallback, so if the server
		// comes back and sends the same list again, the new addresses will be
		// used.
		lb.fullServerList = nil
	}

	balancingPolicyChanged := lb.usePickFirst != pickFirst
	lb.usePickFirst = pickFirst

	if fallbackModeChanged || balancingPolicyChanged {
		// Remove all SubConns when switching balancing policy or switching
		// fallback mode.
		//
		// For fallback mode switching with pickfirst, we want to recreate the
		// SubConn because the creds could be different.
		for a, sc := range lb.subConns {
			sc.Shutdown()
			delete(lb.subConns, a)
		}
	}

	if lb.usePickFirst {
		var (
			scKey resolver.Address
			sc    balancer.SubConn
		)
		for scKey, sc = range lb.subConns {
			break
		}
		if sc != nil {
			if len(backendAddrs) == 0 {
				sc.Shutdown()
				delete(lb.subConns, scKey)
				return
			}
			lb.cc.ClientConn.UpdateAddresses(sc, backendAddrs)
			sc.Connect()
			return
		}
		opts.StateListener = func(scs balancer.SubConnState) { lb.updateSubConnState(sc, scs) }
		// This bypasses the cc wrapper with SubConn cache.
		sc, err := lb.cc.ClientConn.NewSubConn(backendAddrs, opts)
		if err != nil {
			lb.logger.Warningf("Failed to create new SubConn: %v", err)
			return
		}
		sc.Connect()
		lb.subConns[backendAddrs[0]] = sc
		lb.scStates[sc] = connectivity.Idle
		return
	}

	// addrsSet is the set converted from backendAddrsWithoutMetadata, it's used to quick
	// lookup for an address.
	addrsSet := make(map[resolver.Address]struct{})
	// Create new SubConns.
	for _, addr := range backendAddrs {
		addrWithoutAttrs := addr
		addrWithoutAttrs.Attributes = nil
		addrsSet[addrWithoutAttrs] = struct{}{}
		lb.backendAddrsWithoutMetadata = append(lb.backendAddrsWithoutMetadata, addrWithoutAttrs)

		if _, ok := lb.subConns[addrWithoutAttrs]; !ok {
			// Use addrWithMD to create the SubConn.
			var sc balancer.SubConn
			opts.StateListener = func(scs balancer.SubConnState) { lb.updateSubConnState(sc, scs) }
			sc, err := lb.cc.NewSubConn([]resolver.Address{addr}, opts)
			if err != nil {
				lb.logger.Warningf("Failed to create new SubConn: %v", err)
				continue
			}
			lb.subConns[addrWithoutAttrs] = sc // Use the addr without MD as key for the map.
			if _, ok := lb.scStates[sc]; !ok {
				// Only set state of new sc to IDLE. The state could already be
				// READY for cached SubConns.
				lb.scStates[sc] = connectivity.Idle
			}
			sc.Connect()
		}
	}

	for a, sc := range lb.subConns {
		// a was removed by resolver.
		if _, ok := addrsSet[a]; !ok {
			sc.Shutdown()
			delete(lb.subConns, a)
			// Keep the state of this sc in b.scStates until sc's state becomes Shutdown.
			// The entry will be deleted in UpdateSubConnState.
		}
	}

	// Regenerate and update picker after refreshing subconns because with
	// cache, even if SubConn was newed/removed, there might be no state
	// changes (the subconn will be kept in cache, not actually
	// newed/removed).
	lb.updateStateAndPicker(true, true)
}

type remoteBalancerCCWrapper struct {
	cc      *grpc.ClientConn
	lb      *lbBalancer
	backoff backoff.Strategy
	done    chan struct{}

	streamMu     sync.Mutex
	streamCancel func()

	// waitgroup to wait for all goroutines to exit.
	wg sync.WaitGroup
}

func (lb *lbBalancer) newRemoteBalancerCCWrapper() error {
	var dopts []grpc.DialOption
	if creds := lb.opt.DialCreds; creds != nil {
		dopts = append(dopts, grpc.WithTransportCredentials(creds))
	} else if bundle := lb.grpclbClientConnCreds; bundle != nil {
		dopts = append(dopts, grpc.WithCredentialsBundle(bundle))
	} else {
		dopts = append(dopts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}
	if lb.opt.Dialer != nil {
		dopts = append(dopts, grpc.WithContextDialer(lb.opt.Dialer))
	}
	if lb.opt.CustomUserAgent != "" {
		dopts = append(dopts, grpc.WithUserAgent(lb.opt.CustomUserAgent))
	}
	// Explicitly set pickfirst as the balancer.
	dopts = append(dopts, grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"pick_first"}`))
	dopts = append(dopts, grpc.WithResolvers(lb.manualResolver))
	dopts = append(dopts, grpc.WithChannelzParentID(lb.opt.ChannelzParent))

	// Enable Keepalive for grpclb client.
	dopts = append(dopts, grpc.WithKeepaliveParams(keepalive.ClientParameters{
		Time:                20 * time.Second,
		Timeout:             10 * time.Second,
		PermitWithoutStream: true,
	}))

	// The dial target is not important.
	//
	// The grpclb server addresses will set field ServerName, and creds will
	// receive ServerName as authority.
	target := lb.manualResolver.Scheme() + ":///grpclb.subClientConn"
	cc, err := grpc.NewClient(target, dopts...)
	if err != nil {
		return fmt.Errorf("grpc.NewClient(%s): %v", target, err)
	}
	cc.Connect()
	ccw := &remoteBalancerCCWrapper{
		cc:      cc,
		lb:      lb,
		backoff: lb.backoff,
		done:    make(chan struct{}),
	}
	lb.ccRemoteLB = ccw
	ccw.wg.Add(1)
	go ccw.watchRemoteBalancer()
	return nil
}

// close closed the ClientConn to remote balancer, and waits until all
// goroutines to finish.
func (ccw *remoteBalancerCCWrapper) close() {
	close(ccw.done)
	ccw.cc.Close()
	ccw.wg.Wait()
}

func (ccw *remoteBalancerCCWrapper) readServerList(s *balanceLoadClientStream) error {
	for {
		reply, err := s.Recv()
		if err != nil {
			if err == io.EOF {
				return errServerTerminatedConnection
			}
			return fmt.Errorf("grpclb: failed to recv server list: %v", err)
		}
		if serverList := reply.GetServerList(); serverList != nil {
			ccw.lb.processServerList(serverList)
		}
		if reply.GetFallbackResponse() != nil {
			// Eagerly enter fallback
			ccw.lb.mu.Lock()
			ccw.lb.refreshSubConns(ccw.lb.resolvedBackendAddrs, true, ccw.lb.usePickFirst)
			ccw.lb.mu.Unlock()
		}
	}
}

func (ccw *remoteBalancerCCWrapper) sendLoadReport(s *balanceLoadClientStream, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	lastZero := false
	for {
		select {
		case <-ticker.C:
		case <-s.Context().Done():
			return
		}
		stats := ccw.lb.clientStats.toClientStats()
		zero := isZeroStats(stats)
		if zero && lastZero {
			// Quash redundant empty load reports.
			continue
		}
		lastZero = zero
		t := time.Now()
		stats.Timestamp = &timestamppb.Timestamp{
			Seconds: t.Unix(),
			Nanos:   int32(t.Nanosecond()),
		}
		if err := s.Send(&lbpb.LoadBalanceRequest{
			LoadBalanceRequestType: &lbpb.LoadBalanceRequest_ClientStats{
				ClientStats: stats,
			},
		}); err != nil {
			return
		}
	}
}

func (ccw *remoteBalancerCCWrapper) callRemoteBalancer(ctx context.Context) (backoff bool, _ error) {
	lbClient := &loadBalancerClient{cc: ccw.cc}
	stream, err := lbClient.BalanceLoad(ctx, grpc.WaitForReady(true))
	if err != nil {
		return true, fmt.Errorf("grpclb: failed to perform RPC to the remote balancer: %v", err)
	}
	ccw.lb.mu.Lock()
	ccw.lb.remoteBalancerConnected = true
	ccw.lb.mu.Unlock()

	// grpclb handshake on the stream.
	initReq := &lbpb.LoadBalanceRequest{
		LoadBalanceRequestType: &lbpb.LoadBalanceRequest_InitialRequest{
			InitialRequest: &lbpb.InitialLoadBalanceRequest{
				Name: ccw.lb.target,
			},
		},
	}
	if err := stream.Send(initReq); err != nil {
		return true, fmt.Errorf("grpclb: failed to send init request: %v", err)
	}
	reply, err := stream.Recv()
	if err != nil {
		return true, fmt.Errorf("grpclb: failed to recv init response: %v", err)
	}
	initResp := reply.GetInitialResponse()
	if initResp == nil {
		return true, fmt.Errorf("grpclb: reply from remote balancer did not include initial response")
	}

	ccw.wg.Add(1)
	go func() {
		defer ccw.wg.Done()
		if d := convertDuration(initResp.ClientStatsReportInterval); d > 0 {
			ccw.sendLoadReport(stream, d)
		}
	}()
	// No backoff if init req/resp handshake was successful.
	return false, ccw.readServerList(stream)
}

// cancelRemoteBalancerCall cancels the context used by the stream to the remote
// balancer. watchRemoteBalancer() takes care of restarting this call after the
// stream fails.
func (ccw *remoteBalancerCCWrapper) cancelRemoteBalancerCall() {
	ccw.streamMu.Lock()
	if ccw.streamCancel != nil {
		ccw.streamCancel()
		ccw.streamCancel = nil
	}
	ccw.streamMu.Unlock()
}

func (ccw *remoteBalancerCCWrapper) watchRemoteBalancer() {
	defer func() {
		ccw.wg.Done()
		ccw.streamMu.Lock()
		if ccw.streamCancel != nil {
			// This is to make sure that we don't leak the context when we are
			// directly returning from inside of the below `for` loop.
			ccw.streamCancel()
			ccw.streamCancel = nil
		}
		ccw.streamMu.Unlock()
	}()

	var retryCount int
	var ctx context.Context
	for {
		ccw.streamMu.Lock()
		if ccw.streamCancel != nil {
			ccw.streamCancel()
			ccw.streamCancel = nil
		}
		ctx, ccw.streamCancel = context.WithCancel(context.Background())
		ccw.streamMu.Unlock()

		doBackoff, err := ccw.callRemoteBalancer(ctx)
		select {
		case <-ccw.done:
			return
		default:
			if err != nil {
				if err == errServerTerminatedConnection {
					ccw.lb.logger.Infof("Call to remote balancer failed: %v", err)
				} else {
					ccw.lb.logger.Warningf("Call to remote balancer failed: %v", err)
				}
			}
		}
		// Trigger a re-resolve when the stream errors.
		ccw.lb.cc.ClientConn.ResolveNow(resolver.ResolveNowOptions{})

		ccw.lb.mu.Lock()
		ccw.lb.remoteBalancerConnected = false
		ccw.lb.fullServerList = nil
		// Enter fallback when connection to remote balancer is lost, and the
		// aggregated state is not Ready.
		if !ccw.lb.inFallback && ccw.lb.state != connectivity.Ready {
			// Entering fallback.
			ccw.lb.refreshSubConns(ccw.lb.resolvedBackendAddrs, true, ccw.lb.usePickFirst)
		}
		ccw.lb.mu.Unlock()

		if !doBackoff {
			retryCount = 0
			continue
		}

		timer := time.NewTimer(ccw.backoff.Backoff(retryCount)) // Copy backoff
		select {
		case <-timer.C:
		case <-ccw.done:
			timer.Stop()
			return
		}
		retryCount++
	}
}
