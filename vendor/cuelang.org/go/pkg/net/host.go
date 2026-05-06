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

package net

import (
	"fmt"
	"net"
	"strconv"
	"unicode/utf8"

	"golang.org/x/net/idna"

	"cuelang.org/go/cue"
)

var idnaProfile = idna.New(
	idna.ValidateLabels(true),
	idna.VerifyDNSLength(true),
	idna.StrictDomainName(true),
)

// SplitHostPort splits a network address of the form "host:port",
// "host%zone:port", "[host]:port" or "[host%zone]:port" into host or host%zone
// and port.
//
// A literal IPv6 address in hostport must be enclosed in square brackets, as in
// "[::1]:80", "[::1%lo0]:80".
func SplitHostPort(s string) (hostport []string, err error) {
	host, port, err := net.SplitHostPort(s)
	if err != nil {
		return nil, err
	}
	return []string{host, port}, nil
}

// JoinHostPort combines host and port into a network address of the
// form "host:port". If host contains a colon, as found in literal
// IPv6 addresses, then JoinHostPort returns "[host]:port".
//
// See func Dial for a description of the host and port parameters.
func JoinHostPort(host, port cue.Value) (string, error) {
	var err error
	hostStr := ""
	switch host.Kind() {
	case cue.ListKind:
		ipdata := netGetIP(host)
		if len(ipdata) != 4 && len(ipdata) != 16 {
			err = fmt.Errorf("invalid host %s", host)
		}
		hostStr = ipdata.String()
	case cue.BytesKind:
		var b []byte
		b, err = host.Bytes()
		hostStr = string(b)
	default:
		hostStr, err = host.String()
	}
	if err != nil {
		return "", err
	}

	portStr := ""
	switch port.Kind() {
	case cue.StringKind:
		portStr, err = port.String()
	case cue.BytesKind:
		var b []byte
		b, err = port.Bytes()
		portStr = string(b)
	default:
		var i int64
		i, err = port.Int64()
		portStr = strconv.Itoa(int(i))
	}
	if err != nil {
		return "", err
	}

	return net.JoinHostPort(hostStr, portStr), nil
}

// FQDN reports whether is is a valid fully qualified domain name.
//
// FQDN allows only ASCII characters as prescribed by RFC 1034 (A-Z, a-z, 0-9
// and the hyphen).
func FQDN(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] >= utf8.RuneSelf {
			return false
		}
	}
	_, err := idnaProfile.ToASCII(s)
	return err == nil
}
