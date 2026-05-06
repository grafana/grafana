package azendpoint

import (
	"fmt"
	"net/url"
	"strings"
)

type EndpointAllowlist struct {
	entries []allowEntry
}

type allowEntry struct {
	scheme string
	port   string
	host   string
	suffix bool
}

func Allowlist(allowedEndpoints []string) (*EndpointAllowlist, error) {
	var entries = make([]allowEntry, len(allowedEndpoints))

	for i, endpointStr := range allowedEndpoints {
		u, err := url.Parse(endpointStr)
		if err != nil {
			err = fmt.Errorf("invalid allow endpoint: %w", err)
			return nil, err
		}

		allowedScheme := u.Scheme
		allowedHost := u.Hostname()

		allowedPort := explicitPort(u)
		if allowedPort == "" {
			err = fmt.Errorf("invalid allow endpoint '%s': scheme '%s' requires explicit port", endpointStr, u.Scheme)
			return nil, err
		}

		if len(allowedHost) > 2 && strings.HasPrefix(allowedHost, "*.") {
			entries[i] = allowEntry{
				scheme: allowedScheme,
				port:   allowedPort,
				host:   allowedHost[1:],
				suffix: true,
			}
		} else {
			entries[i] = allowEntry{
				scheme: allowedScheme,
				port:   allowedPort,
				host:   allowedHost,
				suffix: false,
			}
		}
	}

	return &EndpointAllowlist{
		entries: entries,
	}, nil
}

func (v *EndpointAllowlist) IsAllowed(endpoint *url.URL) bool {
	if endpoint == nil {
		return false
	}

	scheme := endpoint.Scheme
	if scheme == "" {
		return false
	}

	host := endpoint.Hostname()
	if host == "" {
		return false
	}

	port := explicitPort(endpoint)

	for _, entry := range v.entries {
		if v.matchEntry(entry, scheme, host, port) {
			return true
		}
	}

	return false
}

func (v *EndpointAllowlist) matchEntry(allowEntry allowEntry, scheme string, host string, port string) bool {
	// Scheme
	if scheme != allowEntry.scheme {
		return false
	}

	// Port
	if allowEntry.port != "*" && (port == "" || port != allowEntry.port) {
		return false
	}

	// Host
	if !allowEntry.suffix {
		if strings.ToLower(host) == allowEntry.host {
			return true
		}
	} else {
		hostLen := len(host)
		allowSuffixLen := len(allowEntry.host)
		// Host should be longer than suffix (not equal)
		if hostLen > allowSuffixLen {
			if strings.ToLower(host[hostLen-allowSuffixLen:]) == allowEntry.host {
				return true
			}
		}
	}

	return false
}

var knownPorts = map[string]string{
	"http":  "80",
	"https": "443",
}

func explicitPort(u *url.URL) string {
	port := u.Port()

	if port == "" {
		if knownPort, ok := knownPorts[u.Scheme]; ok {
			port = knownPort
		}
	}

	return port
}
