package http

import (
	"fmt"
	"net"
	"strconv"
	"strings"
)

// ValidateEndpointHost validates that the host string passed in is a valid RFC
// 3986 host. Returns error if the host is not valid.
func ValidateEndpointHost(host string) error {
	var errors strings.Builder
	var hostname string
	var port string
	var err error

	if strings.Contains(host, ":") {
		hostname, port, err = net.SplitHostPort(host)
		if err != nil {
			errors.WriteString(fmt.Sprintf("\n endpoint %v, failed to parse, got ", host))
			errors.WriteString(err.Error())
		}

		if !ValidPortNumber(port) {
			errors.WriteString(fmt.Sprintf("port number should be in range [0-65535], got %v", port))
		}
	} else {
		hostname = host
	}

	labels := strings.Split(hostname, ".")
	for i, label := range labels {
		if i == len(labels)-1 && len(label) == 0 {
			// Allow trailing dot for FQDN hosts.
			continue
		}

		if !ValidHostLabel(label) {
			errors.WriteString("\nendpoint host domain labels must match \"[a-zA-Z0-9-]{1,63}\", but found: ")
			errors.WriteString(label)
		}
	}

	if len(hostname) == 0 && len(port) != 0 {
		errors.WriteString("\nendpoint host with port must not be empty")
	}

	if len(hostname) > 255 {
		errors.WriteString(fmt.Sprintf("\nendpoint host must be less than 255 characters, but was %d", len(hostname)))
	}

	if len(errors.String()) > 0 {
		return fmt.Errorf("invalid endpoint host%s", errors.String())
	}
	return nil
}

// ValidPortNumber returns whether the port is valid RFC 3986 port.
func ValidPortNumber(port string) bool {
	i, err := strconv.Atoi(port)
	if err != nil {
		return false
	}

	if i < 0 || i > 65535 {
		return false
	}
	return true
}

// ValidHostLabel returns whether the label is a valid RFC 3986 host label.
func ValidHostLabel(label string) bool {
	if l := len(label); l == 0 || l > 63 {
		return false
	}
	for _, r := range label {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'A' && r <= 'Z':
		case r >= 'a' && r <= 'z':
		case r == '-':
		default:
			return false
		}
	}

	return true
}
