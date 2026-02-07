// Copyright 2019 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package net defines net-related types.
package net

import (
	"fmt"
	"net"

	"cuelang.org/go/cue"
)

// IP address lengths (bytes).
const (
	IPv4len = 4
	IPv6len = 16
)

func netGetIP(ip cue.Value) (goip net.IP) {
	switch ip.Kind() {
	case cue.StringKind:
		s, err := ip.String()
		if err != nil {
			return nil
		}
		goip := net.ParseIP(s)
		if goip == nil {
			return nil
		}
		return goip

	case cue.BytesKind:
		b, err := ip.Bytes()
		if err != nil {
			return nil
		}
		goip := net.ParseIP(string(b))
		if goip == nil {
			return nil
		}
		return goip

	case cue.ListKind:
		iter, err := ip.List()
		if err != nil {
			return nil
		}
		for iter.Next() {
			v, err := iter.Value().Int64()
			if err != nil {
				return nil
			}
			if v < 0 || 255 < v {
				return nil
			}
			goip = append(goip, byte(v))
		}
		return goip

	default:
		// TODO: return canonical invalid type.
		return nil
	}
}

func netGetIPCIDR(ip cue.Value) (gonet *net.IPNet, err error) {
	switch ip.Kind() {
	case cue.StringKind:
		s, err := ip.String()
		if err != nil {
			return nil, err
		}
		_, gonet, err := net.ParseCIDR(s)
		if err != nil {
			return nil, err
		}
		return gonet, nil

	case cue.BytesKind:
		b, err := ip.Bytes()
		if err != nil {
			return nil, err
		}
		_, gonet, err := net.ParseCIDR(string(b))
		if err != nil {
			return nil, err
		}
		return gonet, nil

	default:
		// TODO: return canonical invalid type.
		return nil, nil
	}
}

// ParseIP parses s as an IP address, returning the result.
// The string s can be in dotted decimal ("192.0.2.1")
// or IPv6 ("2001:db8::68") form.
// If s is not a valid textual representation of an IP address,
// ParseIP returns nil.
func ParseIP(s string) ([]uint, error) {
	goip := net.ParseIP(s)
	if goip == nil {
		return nil, fmt.Errorf("invalid IP address %q", s)
	}
	return netToList(goip), nil
}

func netToList(ip net.IP) []uint {
	a := make([]uint, len(ip))
	for i, p := range ip {
		a[i] = uint(p)
	}
	return a
}

// IPv4 reports whether s is a valid IPv4 address.
//
// The address may be a string or list of bytes.
func IPv4(ip cue.Value) bool {
	// TODO: convert to native CUE.
	return netGetIP(ip).To4() != nil
}

// IP reports whether s is a valid IPv4 or IPv6 address.
//
// The address may be a string or list of bytes.
func IP(ip cue.Value) bool {
	// TODO: convert to native CUE.
	return netGetIP(ip) != nil
}

// IPCIDR reports whether ip is a valid IPv4 or IPv6 address with CIDR subnet notation.
//
// The address may be a string or list of bytes.
func IPCIDR(ip cue.Value) (bool, error) {
	_, err := netGetIPCIDR(ip)
	return err == nil, err
}

// LoopbackIP reports whether ip is a loopback address.
func LoopbackIP(ip cue.Value) bool {
	return netGetIP(ip).IsLoopback()
}

// MulticastIP reports whether ip is a multicast address.
func MulticastIP(ip cue.Value) bool {
	return netGetIP(ip).IsMulticast()
}

// InterfaceLocalMulticastIP reports whether ip is an interface-local multicast
// address.
func InterfaceLocalMulticastIP(ip cue.Value) bool {
	return netGetIP(ip).IsInterfaceLocalMulticast()
}

// LinkLocalMulticast reports whether ip is a link-local multicast address.
func LinkLocalMulticastIP(ip cue.Value) bool {
	return netGetIP(ip).IsLinkLocalMulticast()
}

// LinkLocalUnicastIP reports whether ip is a link-local unicast address.
func LinkLocalUnicastIP(ip cue.Value) bool {
	return netGetIP(ip).IsLinkLocalUnicast()
}

// GlobalUnicastIP reports whether ip is a global unicast address.
//
// The identification of global unicast addresses uses address type
// identification as defined in RFC 1122, RFC 4632 and RFC 4291 with the
// exception of IPv4 directed broadcast addresses. It returns true even if ip is
// in IPv4 private address space or local IPv6 unicast address space.
func GlobalUnicastIP(ip cue.Value) bool {
	return netGetIP(ip).IsGlobalUnicast()
}

// UnspecifiedIP reports whether ip is an unspecified address, either the IPv4
// address "0.0.0.0" or the IPv6 address "::".
func UnspecifiedIP(ip cue.Value) bool {
	return netGetIP(ip).IsUnspecified()
}

// ToIP4 converts a given IP address, which may be a string or a list, to its
// 4-byte representation.
func ToIP4(ip cue.Value) ([]uint, error) {
	ipdata := netGetIP(ip)
	if ipdata == nil {
		return nil, fmt.Errorf("invalid IP %q", ip)
	}
	ipv4 := ipdata.To4()
	if ipv4 == nil {
		return nil, fmt.Errorf("cannot convert %q to IPv4", ipdata)
	}
	return netToList(ipv4), nil
}

// ToIP16 converts a given IP address, which may be a string or a list, to its
// 16-byte representation.
func ToIP16(ip cue.Value) ([]uint, error) {
	ipdata := netGetIP(ip)
	if ipdata == nil {
		return nil, fmt.Errorf("invalid IP %q", ip)
	}
	return netToList(ipdata), nil
}

// IPString returns the string form of the IP address ip. It returns one of 4 forms:
//
// - "<nil>", if ip has length 0
// - dotted decimal ("192.0.2.1"), if ip is an IPv4 or IP4-mapped IPv6 address
// - IPv6 ("2001:db8::1"), if ip is a valid IPv6 address
// - the hexadecimal form of ip, without punctuation, if no other cases apply
func IPString(ip cue.Value) (string, error) {
	ipdata := netGetIP(ip)
	if ipdata == nil {
		return "", fmt.Errorf("invalid IP %q", ip)
	}
	return ipdata.String(), nil
}
