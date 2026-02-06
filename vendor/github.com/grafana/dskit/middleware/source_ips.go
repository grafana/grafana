// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/source_ips.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

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
	// Allows to extract the host from the X-Forwarded-For header.
	// Will strip out any spaces or double quote surrounding host.
	xForwardedForRegex = regexp.MustCompile(`(?: *"?([^,]+)"? *)`)
)

var (
	// RFC7239 defines a new "Forwarded: " header designed to replace the
	// existing use of X-Forwarded-* headers.
	// e.g. Forwarded: for=192.0.2.60;proto=https;by=203.0.113.43
	forwarded = http.CanonicalHeaderKey("Forwarded")
	// Allows to extract the host from the for clause of the Forwarded header.
	// Will strip out any spaces or double quote surrounding host.
	forwardedRegex = regexp.MustCompile(`(?i)(?:for=)(?: *"?([^;,]+)"? *)`)
)

// SourceIPExtractor extracts the source IPs from a HTTP request
type SourceIPExtractor struct {
	// The header to search for
	header string
	// A regex that extracts the IP address from the header.
	// It should contain at least one capturing group the first of which will be returned.
	regex *regexp.Regexp
	// A boolean to choose if we should return all found IP or just first match
	extractAllHosts bool
}

// NewSourceIPs creates a new SourceIPs
func NewSourceIPs(header, regex string, extractAllHosts bool) (*SourceIPExtractor, error) {
	if (header == "" && regex != "") || (header != "" && regex == "") {
		return nil, fmt.Errorf("either both a header field and a regex have to be given or neither")
	}
	re, err := regexp.Compile(regex)
	if err != nil {
		return nil, fmt.Errorf("invalid regex given")
	}

	return &SourceIPExtractor{
		header:          header,
		regex:           re,
		extractAllHosts: extractAllHosts,
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
	hosts := []string{}

	// Remove port informations from extracted address
	for _, addr := range sips.getIP(req) {
		hosts = append(hosts, extractHost(addr))
	}

	fwd := strings.Join(hosts, ", ")

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
func (sips SourceIPExtractor) getIP(r *http.Request) []string {
	var addrs = []string{}

	// Use the custom regex only if it was setup
	if sips.header != "" {
		hdr := r.Header.Get(sips.header)
		if hdr == "" {
			return addrs
		}

		addrs = sips.extractHeader(hdr, sips.regex)
	} else if fwd := r.Header.Get(forwarded); fwd != "" {
		addrs = sips.extractHeader(fwd, forwardedRegex)
	} else if fwd := r.Header.Get(xRealIP); fwd != "" {
		// X-Real-IP should only contain one IP address (the client making the
		// request).
		addrs = append([]string{}, fwd)
	} else if fwd := strings.ReplaceAll(r.Header.Get(xForwardedFor), " ", ""); fwd != "" {
		addrs = sips.extractHeader(fwd, xForwardedForRegex)
	}

	return addrs
}

// extractHeader is a toolbox function that will parse a header content with a regex and return a list
// of all matching groups as string.
func (sips SourceIPExtractor) extractHeader(header string, regex *regexp.Regexp) []string {
	var addrs = []string{}

	if allMatches := regex.FindAllStringSubmatch(header, -1); len(allMatches) > 0 {
		for _, match := range allMatches {
			if len(match) > 1 {
				addrs = append(addrs, match[1])
			}
			if !sips.extractAllHosts {
				break
			}
		}
	}

	return addrs
}
