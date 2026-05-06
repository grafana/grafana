// Copyright 2018 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cluster

import (
	"errors"
	"fmt"
	"net"

	"github.com/hashicorp/go-sockaddr"
)

type getIPFunc func() (string, error)

// These are overridden in unit tests to mock the sockaddr functions.
var (
	getPrivateAddress getIPFunc = sockaddr.GetPrivateIP
	getPublicAddress  getIPFunc = sockaddr.GetPublicIP
)

// calculateAdvertiseAddress attempts to clone logic from deep within memberlist
// (NetTransport.FinalAdvertiseAddr) in order to surface its conclusions to the
// application, so we can provide more actionable error messages if the user has
// inadvertently misconfigured their cluster.
//
// https://github.com/hashicorp/memberlist/blob/022f081/net_transport.go#L126
func calculateAdvertiseAddress(bindAddr, advertiseAddr string, allowInsecureAdvertise bool) (net.IP, error) {
	if advertiseAddr != "" {
		ip := net.ParseIP(advertiseAddr)
		if ip == nil {
			return nil, fmt.Errorf("failed to parse advertise addr '%s'", advertiseAddr)
		}
		if ip4 := ip.To4(); ip4 != nil {
			ip = ip4
		}
		return ip, nil
	}

	if isAny(bindAddr) {
		return discoverAdvertiseAddress(allowInsecureAdvertise)
	}

	ip := net.ParseIP(bindAddr)
	if ip == nil {
		return nil, fmt.Errorf("failed to parse bind addr '%s'", bindAddr)
	}
	return ip, nil
}

// discoverAdvertiseAddress will attempt to get a single IP address to use as
// the advertise address when one is not explicitly provided. It defaults to
// using a private IP address, and if not found then using a public IP if
// insecure advertising is allowed.
func discoverAdvertiseAddress(allowInsecureAdvertise bool) (net.IP, error) {
	addr, err := getPrivateAddress()
	if err != nil {
		return nil, fmt.Errorf("failed to get private IP: %w", err)
	}
	if addr == "" && !allowInsecureAdvertise {
		return nil, errors.New("no private IP found, explicit advertise addr not provided")
	}

	if addr == "" {
		addr, err = getPublicAddress()
		if err != nil {
			return nil, fmt.Errorf("failed to get public IP: %w", err)
		}
		if addr == "" {
			return nil, errors.New("no private/public IP found, explicit advertise addr not provided")
		}
	}

	ip := net.ParseIP(addr)
	if ip == nil {
		return nil, fmt.Errorf("failed to parse discovered IP '%s'", addr)
	}
	return ip, nil
}
