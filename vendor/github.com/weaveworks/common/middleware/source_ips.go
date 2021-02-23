package middleware

import (
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
)

// Parts copied and changed from gorilla mux proxy_headers.go

var (
	// De-facto standard header keys.
	xForwardedFor = http.CanonicalHeaderKey("X-Forwarded-For")
	xRealIP       = http.CanonicalHeaderKey("X-Real-IP")
)

var (
	// RFC7239 defines a new "Forwarded: " header designed to replace the
	// existing use of X-Forwarded-* headers.
	// e.g. Forwarded: for=192.0.2.60;proto=https;by=203.0.113.43
	forwarded = http.CanonicalHeaderKey("Forwarded")
	// Allows for a sub-match of the first value after 'for=' to the next
	// comma, semi-colon or space. The match is case-insensitive.
	forRegex = regexp.MustCompile(`(?i)(?:for=)([^(;|,| )]+)`)
)

// SourceIPExtractor extracts the source IPs from a HTTP request
type SourceIPExtractor struct {
	// The header to search for
	header string
	// A regex that extracts the IP address from the header.
	// It should contain at least one capturing group the first of which will be returned.
	regex *regexp.Regexp
}

// NewSourceIPs creates a new SourceIPs
func NewSourceIPs(header, regex string) (*SourceIPExtractor, error) {
	if (header == "" && regex != "") || (header != "" && regex == "") {
		return nil, fmt.Errorf("either both a header field and a regex have to be given or neither")
	}
	re, err := regexp.Compile(regex)
	if err != nil {
		return nil, fmt.Errorf("invalid regex given")
	}

	return &SourceIPExtractor{
		header: header,
		regex:  re,
	}, nil
}

// extractHost returns the Host IP address without any port information
func extractHost(address string) string {
	hostIP := net.ParseIP(address)
	if hostIP != nil {
		return hostIP.String()
	}
	var err error
	hostStr, _, err := net.SplitHostPort(address)
	if err != nil {
		// Invalid IP address, just return it so it shows up in the logs
		return address
	}
	return hostStr
}

// Get returns any source addresses we can find in the request, comma-separated
func (sips SourceIPExtractor) Get(req *http.Request) string {
	fwd := extractHost(sips.getIP(req))
	if fwd == "" {
		if req.RemoteAddr == "" {
			return ""
		}
		return extractHost(req.RemoteAddr)
	}
	// If RemoteAddr is empty just return the header
	if req.RemoteAddr == "" {
		return fwd
	}
	remoteIP := extractHost(req.RemoteAddr)
	if fwd == remoteIP {
		return remoteIP
	}
	// If both a header and RemoteAddr are present return them both, stripping off any port info from the RemoteAddr
	return fmt.Sprintf("%v, %v", fwd, remoteIP)
}

// getIP retrieves the IP from the RFC7239 Forwarded headers,
// X-Real-IP and X-Forwarded-For (in that order) or from the
// custom regex.
func (sips SourceIPExtractor) getIP(r *http.Request) string {
	var addr string

	// Use the custom regex only if it was setup
	if sips.header != "" {
		hdr := r.Header.Get(sips.header)
		if hdr == "" {
			return ""
		}
		allMatches := sips.regex.FindAllStringSubmatch(hdr, 1)
		if len(allMatches) == 0 {
			return ""
		}
		firstMatch := allMatches[0]
		// Check there is at least 1 submatch
		if len(firstMatch) < 2 {
			return ""
		}
		return firstMatch[1]
	}

	if fwd := r.Header.Get(forwarded); fwd != "" {
		// match should contain at least two elements if the protocol was
		// specified in the Forwarded header. The first element will always be
		// the 'for=' capture, which we ignore. In the case of multiple IP
		// addresses (for=8.8.8.8, 8.8.4.4,172.16.1.20 is valid) we only
		// extract the first, which should be the client IP.
		if match := forRegex.FindStringSubmatch(fwd); len(match) > 1 {
			// IPv6 addresses in Forwarded headers are quoted-strings. We strip
			// these quotes.
			addr = strings.Trim(match[1], `"`)
		}
	} else if fwd := r.Header.Get(xRealIP); fwd != "" {
		// X-Real-IP should only contain one IP address (the client making the
		// request).
		addr = fwd
	} else if fwd := strings.ReplaceAll(r.Header.Get(xForwardedFor), " ", ""); fwd != "" {
		// Only grab the first (client) address. Note that '192.168.0.1,
		// 10.1.1.1' is a valid key for X-Forwarded-For where addresses after
		// the first may represent forwarding proxies earlier in the chain.
		s := strings.Index(fwd, ",")
		if s == -1 {
			s = len(fwd)
		}
		addr = fwd[:s]
	}

	return addr
}
