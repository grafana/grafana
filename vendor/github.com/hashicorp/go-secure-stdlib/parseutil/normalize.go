// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package parseutil

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// general delimiters as defined in RFC-3986 §2.2
// See: https://www.rfc-editor.org/rfc/rfc3986#section-2.2
const genDelims = ":/?#[]@"

func normalizeHostPort(host string, port string) (string, error) {
	if host == "" {
		return "", fmt.Errorf("empty hostname")
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.To4() == nil && ip.To16() != nil && port == "" {
			// this is a unique case, host is ipv6 and requires brackets due to
			// being part of a url, but they won't be added by net.JoinHostPort
			// as there is no port
			// See: https://www.rfc-editor.org/rfc/rfc3986#section-3.2.2
			return "[" + ip.String() + "]", nil
		}
		host = ip.String()
	} else if strings.Contains(host, ":") {
		// host is an invalid ipv6 literal.
		// hosts cannot contain certain reserved characters, including ":"
		// See: https://www.rfc-editor.org/rfc/rfc3986#section-2.2,
		//      https://www.rfc-editor.org/rfc/rfc3986#section-3.2.2
		return "", fmt.Errorf("host contains an invalid IPv6 literal")
	}
	if port == "" {
		return host, nil
	}
	return net.JoinHostPort(host, port), nil
}

func parseUrl(addr string) (string, error) {
	if u, err := url.Parse(addr); err == nil {
		if strings.HasSuffix(u.Host, ":") {
			return "", fmt.Errorf("url has malformed host: missing port value after colon")
		}
		if u.Host, err = normalizeHostPort(u.Hostname(), u.Port()); err != nil {
			return "", err
		}
		return u.String(), nil
	}
	return "", fmt.Errorf("failed to parse address")
}

// NormalizeAddr takes an address as a string and returns a normalized copy.
// If the address is a URL, IP Address, or host:port address that includes an
// IPv6 address, the normalized copy will be conformant with RFC-5952 §4. If
// the address cannot be parsed, an error will be returned.
//
// There are two valid formats:
//
// - hosts: "host"
//   - may be any of: IPv6 literal, IPv4 literal, dns name, or [sub]domain name
//   - IPv6 literals cannot be encapsulated within square brackets in this format
//
// - URIs: "[scheme://] [user@] host [:port] [/path] [?query] [#frag]"
//   - format should conform with RFC-3986 §3 or else the returned address may
//     be parsed and formatted incorrectly
//   - hosts containing IPv6 literals MUST be encapsulated within square brackets,
//     as defined in RFC-3986 §3.2.2 and RFC-5952 §6
//   - all non-host components are optional
//
// See:
//   - https://www.rfc-editor.org/rfc/rfc5952
//   - https://www.rfc-editor.org/rfc/rfc3986
func NormalizeAddr(address string) (string, error) {
	if address == "" {
		return "", fmt.Errorf("empty address")
	}

	if strings.HasPrefix(address, "[") && strings.HasSuffix(address, "]") {
		return "", fmt.Errorf("address cannot be encapsulated by brackets")
	}

	if ip := net.ParseIP(address); ip != nil {
		return ip.String(), nil
	}

	// if the provided address does not have a scheme provided, attempt to
	// provide one and re-parse the result. this is done by looking for the
	// first general delimiter and checking if it exists or if it's not a colon
	// or by subsequently checking if the first character of the address is a
	// letter or a colon or if the colon is part of "://"
	// See: https://www.rfc-editor.org/rfc/rfc3986#section-3
	//
	// though the first character being a colon is not mentioned in the scheme
	// spec, we check for it as url.Parse will read certain invalid ipv6
	// addresses as valid urls, and we want to avoid that
	idx := strings.IndexAny(address, genDelims)
	switch {
	case idx < 0:
		fallthrough
	case address[idx] != ':':
		fallthrough
		// by this point we already know that idx > 0 and that address[idx] == ':'
	case idx > 1 && !strings.HasPrefix(address[idx:], "://"):
		const scheme = "default://"
		// attempt to parse it as a url. we only want to try this func when we
		// know for sure it has a scheme, since it will parse ANYTHING, but
		// just put it into u.Path when called without the scheme
		u, err := parseUrl(scheme + address)
		if err != nil {
			return "", err
		}
		return strings.TrimPrefix(u, scheme), nil

	default:
		return parseUrl(address)
	}
}
