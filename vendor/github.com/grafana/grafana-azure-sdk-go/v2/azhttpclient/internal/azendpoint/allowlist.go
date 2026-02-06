package azendpoint

import (
	"fmt"
	"net/url"
	"slices"
	"strings"
)

type EndpointAllowlist struct {
	entries []allowEntry
}

type allowEntry struct {
	scheme         string
	port           string
	host           string
	suffix         bool
	nestedWildcard bool
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
			nestedWildcard := strings.Contains(allowedHost[2:], "*")
			entries[i] = allowEntry{
				scheme:         allowedScheme,
				port:           allowedPort,
				host:           allowedHost[1:],
				suffix:         true,
				nestedWildcard: nestedWildcard,
			}
		} else {
			// We don't need to set the nestedWildcard value here
			// as by default we use the nested matcher
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

	// If there is no prefix wildcard we can use the nested matcher by default
	if !allowEntry.suffix {
		splitHost := strings.Split(strings.ToLower(host), ".")
		splitAllowedHost := strings.Split(strings.ToLower(allowEntry.host), ".")
		return nestedWildcardMatcher(splitHost, splitAllowedHost)
	} else {
		// If there are no nested wildcards we can use a simple suffix match
		if !allowEntry.nestedWildcard {
			hostLen := len(host)
			allowSuffixLen := len(allowEntry.host)
			// Host should be longer than suffix (not equal)
			if hostLen > allowSuffixLen {
				if strings.EqualFold(host[hostLen-allowSuffixLen:], allowEntry.host) {
					return true
				}
			}
		} else {
			splitHost := strings.Split(strings.ToLower(host), ".")
			allowedHostSplit := strings.Split(strings.ToLower(allowEntry.host), ".")

			// The number of path segments in the host should be at least equal to the allowed host
			if len(splitHost) < len(allowedHostSplit) {
				return false
			}

			// We remove the initial . value
			allowedHostExclPrefix := allowedHostSplit[1:]
			// Find the first non-wildcard part in the allowed host
			nonWildcardAllowPath := slices.IndexFunc(allowedHostExclPrefix, func(r string) bool {
				return r != "*"
			})

			// If there are no non-wildcard parts then we shouldn't be here
			if nonWildcardAllowPath == -1 {
				return false
			}

			// We now truncate the host to start from the first non-wildcard part
			// e.g. for an allowed endpoint of *.second.*.net
			// and a host of first.second.third.net
			// we will truncate the host to second.third.net
			nonWildcardPath := allowedHostExclPrefix[nonWildcardAllowPath]
			hostPath := slices.Index(splitHost, nonWildcardPath)

			// If the host doesn't contain the first allowed non-wildcard part then it can't match
			if hostPath == -1 {
				return false
			}

			hostExcludingPrefix := splitHost[hostPath:]
			if len(hostExcludingPrefix) != len(allowedHostExclPrefix) {
				return false
			}

			return nestedWildcardMatcher(hostExcludingPrefix, allowedHostExclPrefix)
		}
		return false
	}
}

func nestedWildcardMatcher(splitHost []string, splitAllowedHost []string) bool {
	if len(splitHost) != len(splitAllowedHost) {
		return false
	}
	for i, part := range splitAllowedHost {
		if part == "*" {
			continue
		}
		if splitHost[i] != part {
			return false
		}
	}
	return true
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
