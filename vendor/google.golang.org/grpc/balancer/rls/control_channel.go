/*
 *
 * Copyright 2021 gRPC authors.
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
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/balancer/rls/internal/adaptive"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/internal"
	"google.golang.org/grpc/internal/buffer"
	internalgrpclog "google.golang.org/grpc/internal/grpclog"
	"google.golang.org/grpc/internal/grpcsync"
	"google.golang.org/grpc/internal/pretty"
	rlsgrpc "google.golang.org/grpc/internal/proto/grpc_lookup_v1"
	rlspb "google.golang.org/grpc/internal/proto/grpc_lookup_v1"
)

var newAdaptiveThrottler = func() adaptiveThrottler { return adaptive.New() }

type adaptiveThrottler interface {
	ShouldThrottle() bool
	RegisterBackendResponse(throttled bool)
}

// controlChannel is a wrapper around the gRPC channel to the RLS server
// specified in the service config.
type controlChannel struct {
	// rpcTimeout specifies the timeout for the RouteLookup RPC call. The LB
	// policy receives this value in its service config.
	rpcTimeout time.Duration
	// backToReadyFunc is a callback to be invoked when the connectivity state
	// changes from READY --> TRANSIENT_FAILURE --> READY.
	backToReadyFunc func()
	// throttler in an adaptive throttling implementation used to avoid
	// hammering the RLS service while it is overloaded or down.
	throttler adaptiveThrottler

	cc                  *grpc.ClientConn
	client              rlsgrpc.RouteLookupServiceClient
	logger              *internalgrpclog.PrefixLogger
	connectivityStateCh *buffer.Unbounded
	unsubscribe         func()
	monitorDoneCh       chan struct{}
}

// newControlChannel creates a controlChannel to rlsServerName and uses
// serviceConfig, if non-empty, as the default service config for the underlying
// gRPC channel.
func newControlChannel(rlsServerName, serviceConfig string, rpcTimeout time.Duration, bOpts balancer.BuildOptions, backToReadyFunc func()) (*controlChannel, error) {
	ctrlCh := &controlChannel{
		rpcTimeout:          rpcTimeout,
		backToReadyFunc:     backToReadyFunc,
		throttler:           newAdaptiveThrottler(),
		connectivityStateCh: buffer.NewUnbounded(),
		monitorDoneCh:       make(chan struct{}),
	}
	ctrlCh.logger = internalgrpclog.NewPrefixLogger(logger, fmt.Sprintf("[rls-control-channel %p] ", ctrlCh))

	dopts, err := ctrlCh.dialOpts(bOpts, serviceConfig)
	if err != nil {
		return nil, err
	}
	ctrlCh.cc, err = grpc.NewClient(rlsServerName, dopts...)
	if err != nil {
		return nil, err
	}
	// Subscribe to connectivity state before connecting to avoid missing initial
	// updates, which are only delivered to active subscribers.
	ctrlCh.unsubscribe = internal.SubscribeToConnectivityStateChanges.(func(cc *grpc.ClientConn, s grpcsync.Subscriber) func())(ctrlCh.cc, ctrlCh)
	ctrlCh.cc.Connect()
	ctrlCh.client = rlsgrpc.NewRouteLookupServiceClient(ctrlCh.cc)
	ctrlCh.logger.Infof("Control channel created to RLS server at: %v", rlsServerName)
	go ctrlCh.monitorConnectivityState()
	return ctrlCh, nil
}

func (cc *controlChannel) OnMessage(msg any) {
	st, ok := msg.(connectivity.State)
	if !ok {
		panic(fmt.Sprintf("Unexpected message type %T , wanted connectectivity.State type", msg))
	}
	cc.connectivityStateCh.Put(st)
}

// dialOpts constructs the dial options for the control plane channel.
func (cc *controlChannel) dialOpts(bOpts balancer.BuildOptions, serviceConfig string) ([]grpc.DialOption, error) {
	// The control plane channel will use the same authority as the parent
	// channel for server authorization. This ensures that the identity of the
	// RLS server and the identity of the backends is the same, so if the RLS
	// config is injected by an attacker, it cannot cause leakage of private
	// information contained in headers set by the application.
	dopts := []grpc.DialOption{grpc.WithAuthority(bOpts.Authority)}
	if bOpts.Dialer != nil {
		dopts = append(dopts, grpc.WithContextDialer(bOpts.Dialer))
	}
	// The control channel will use the channel credentials from the parent
	// channel, including any call creds associated with the channel creds.
	var credsOpt grpc.DialOption
	switch {
	case bOpts.DialCreds != nil:
		credsOpt = grpc.WithTransportCredentials(bOpts.DialCreds.Clone())
	case bOpts.CredsBundle != nil:
		// The "fallback" mode in google default credentials (which is the only
		// type of credentials we expect to be used with RLS) uses TLS/ALTS
		// creds for transport and uses the same call creds as that on the
		// parent bundle.
		bundle, err := bOpts.CredsBundle.NewWithMode(internal.CredsBundleModeFallback)
		if err != nil {
			return nil, err
		}
		credsOpt = grpc.WithCredentialsBundle(bundle)
	default:
		cc.logger.Warningf("no credentials available, using Insecure")
		credsOpt = grpc.WithTransportCredentials(insecure.NewCredentials())
	}
	dopts = append(dopts, credsOpt)

	// If the RLS LB policy's configuration specified a service config for the
	// control channel, use that and disable service config fetching via the name
	// resolver for the control channel.
	if serviceConfig != "" {
		cc.logger.Infof("Disabling service config from the name resolver and instead using: %s", serviceConfig)
		dopts = append(dopts, grpc.WithDisableServiceConfig(), grpc.WithDefaultServiceConfig(serviceConfig))
	}

	return dopts, nil
}

func (cc *controlChannel) monitorConnectivityState() {
	cc.logger.Infof("Starting connectivity state monitoring goroutine")
	defer close(cc.monitorDoneCh)

	// Since we use two mechanisms to deal with RLS server being down:
	//   - adaptive throttling for the channel as a whole
	//   - exponential backoff on a per-request basis
	// we need a way to avoid double-penalizing requests by counting failures
	// toward both mechanisms when the RLS server is unreachable.
	//
	// To accomplish this, we monitor the state of the control plane channel. If
	// the state has been TRANSIENT_FAILURE since the last time it was in state
	// READY, and it then transitions into state READY, we push on a channel
	// which is being read by the LB policy.
	//
	// The LB the policy will iterate through the cache to reset the backoff
	// timeouts in all cache entries. Specifically, this means that it will
	// reset the backoff state and cancel the pending backoff timer. Note that
	// when cancelling the backoff timer, just like when the backoff timer fires
	// normally, a new picker is returned to the channel, to force it to
	// re-process any wait-for-ready RPCs that may still be queued if we failed
	// them while we were in backoff. However, we should optimize this case by
	// returning only one new picker, regardless of how many backoff timers are
	// cancelled.

	// Wait for the control channel to become READY for the first time.
	for s, ok := <-cc.connectivityStateCh.Get(); s != connectivity.Ready; s, ok = <-cc.connectivityStateCh.Get() {
		if !ok {
			return
		}

		cc.connectivityStateCh.Load()
		if s == connectivity.Shutdown {
			return
		}
	}
	cc.connectivityStateCh.Load()
	cc.logger.Infof("Connectivity state is READY")

	for {
		s, ok := <-cc.connectivityStateCh.Get()
		if !ok {
			return
		}
		cc.connectivityStateCh.Load()

		if s == connectivity.Shutdown {
			return
		}
		if s == connectivity.Ready {
			cc.logger.Infof("Control channel back to READY")
			cc.backToReadyFunc()
		}

		cc.logger.Infof("Connectivity state is %s", s)
	}
}

func (cc *controlChannel) close() {
	cc.unsubscribe()
	cc.connectivityStateCh.Close()
	<-cc.monitorDoneCh
	cc.cc.Close()
	cc.logger.Infof("Shutdown")
}

type lookupCallback func(targets []string, headerData string, err error)

// lookup starts a RouteLookup RPC in a separate goroutine and returns the
// results (and error, if any) in the provided callback.
//
// The returned boolean indicates whether the request was throttled by the
// client-side adaptive throttling algorithm in which case the provided callback
// will not be invoked.
func (cc *controlChannel) lookup(reqKeys map[string]string, reason rlspb.RouteLookupRequest_Reason, staleHeaders string, cb lookupCallback) (throttled bool) {
	if cc.throttler.ShouldThrottle() {
		cc.logger.Infof("RLS request throttled by client-side adaptive throttling")
		return true
	}
	go func() {
		req := &rlspb.RouteLookupRequest{
			TargetType:      "grpc",
			KeyMap:          reqKeys,
			Reason:          reason,
			StaleHeaderData: staleHeaders,
		}
		if cc.logger.V(2) {
			cc.logger.Infof("Sending RLS request %+v", pretty.ToJSON(req))
		}

		ctx, cancel := context.WithTimeout(context.Background(), cc.rpcTimeout)
		defer cancel()
		resp, err := cc.client.RouteLookup(ctx, req)
		cb(resp.GetTargets(), resp.GetHeaderData(), err)
	}()
	return false
}
