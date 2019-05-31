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
	"fmt"
	"strings"

	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/internal/channelz"
	"google.golang.org/grpc/resolver"
)

// ccResolverWrapper is a wrapper on top of cc for resolvers.
// It implements resolver.ClientConnection interface.
type ccResolverWrapper struct {
	cc                 *ClientConn
	resolver           resolver.Resolver
	addrCh             chan []resolver.Address
	scCh               chan string
	done               chan struct{}
	lastAddressesCount int
}

// split2 returns the values from strings.SplitN(s, sep, 2).
// If sep is not found, it returns ("", "", false) instead.
func split2(s, sep string) (string, string, bool) {
	spl := strings.SplitN(s, sep, 2)
	if len(spl) < 2 {
		return "", "", false
	}
	return spl[0], spl[1], true
}

// parseTarget splits target into a struct containing scheme, authority and
// endpoint.
//
// If target is not a valid scheme://authority/endpoint, it returns {Endpoint:
// target}.
func parseTarget(target string) (ret resolver.Target) {
	var ok bool
	ret.Scheme, ret.Endpoint, ok = split2(target, "://")
	if !ok {
		return resolver.Target{Endpoint: target}
	}
	ret.Authority, ret.Endpoint, ok = split2(ret.Endpoint, "/")
	if !ok {
		return resolver.Target{Endpoint: target}
	}
	return ret
}

// newCCResolverWrapper parses cc.target for scheme and gets the resolver
// builder for this scheme and builds the resolver. The monitoring goroutine
// for it is not started yet and can be created by calling start().
//
// If withResolverBuilder dial option is set, the specified resolver will be
// used instead.
func newCCResolverWrapper(cc *ClientConn) (*ccResolverWrapper, error) {
	rb := cc.dopts.resolverBuilder
	if rb == nil {
		return nil, fmt.Errorf("could not get resolver for scheme: %q", cc.parsedTarget.Scheme)
	}

	ccr := &ccResolverWrapper{
		cc:     cc,
		addrCh: make(chan []resolver.Address, 1),
		scCh:   make(chan string, 1),
		done:   make(chan struct{}),
	}

	var err error
	ccr.resolver, err = rb.Build(cc.parsedTarget, ccr, resolver.BuildOption{DisableServiceConfig: cc.dopts.disableServiceConfig})
	if err != nil {
		return nil, err
	}
	return ccr, nil
}

func (ccr *ccResolverWrapper) resolveNow(o resolver.ResolveNowOption) {
	ccr.resolver.ResolveNow(o)
}

func (ccr *ccResolverWrapper) close() {
	ccr.resolver.Close()
	close(ccr.done)
}

// NewAddress is called by the resolver implemenetion to send addresses to gRPC.
func (ccr *ccResolverWrapper) NewAddress(addrs []resolver.Address) {
	select {
	case <-ccr.done:
		return
	default:
	}
	grpclog.Infof("ccResolverWrapper: sending new addresses to cc: %v", addrs)
	if channelz.IsOn() {
		ccr.addChannelzTraceEvent(addrs)
	}
	ccr.cc.handleResolvedAddrs(addrs, nil)
}

// NewServiceConfig is called by the resolver implemenetion to send service
// configs to gRPC.
func (ccr *ccResolverWrapper) NewServiceConfig(sc string) {
	select {
	case <-ccr.done:
		return
	default:
	}
	grpclog.Infof("ccResolverWrapper: got new service config: %v", sc)
	ccr.cc.handleServiceConfig(sc)
}

func (ccr *ccResolverWrapper) addChannelzTraceEvent(addrs []resolver.Address) {
	if len(addrs) == 0 && ccr.lastAddressesCount != 0 {
		channelz.AddTraceEvent(ccr.cc.channelzID, &channelz.TraceEventDesc{
			Desc:     "Resolver returns an empty address list",
			Severity: channelz.CtWarning,
		})
	} else if len(addrs) != 0 && ccr.lastAddressesCount == 0 {
		var s string
		for i, a := range addrs {
			if a.ServerName != "" {
				s += a.Addr + "(" + a.ServerName + ")"
			} else {
				s += a.Addr
			}
			if i != len(addrs)-1 {
				s += " "
			}
		}
		channelz.AddTraceEvent(ccr.cc.channelzID, &channelz.TraceEventDesc{
			Desc:     fmt.Sprintf("Resolver returns a non-empty address list (previous one was empty) %q", s),
			Severity: channelz.CtINFO,
		})
	}
	ccr.lastAddressesCount = len(addrs)
}
