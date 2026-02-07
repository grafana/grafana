package config

import (
	"fmt"
	"strings"
)

// ClientEnableState provides an enumeration if the client is enabled,
// disabled, or default behavior.
type ClientEnableState uint

// Enumeration values for ClientEnableState
const (
	ClientDefaultEnableState ClientEnableState = iota
	ClientDisabled
	ClientEnabled
)

// EndpointModeState is the EC2 IMDS Endpoint Configuration Mode
type EndpointModeState uint

// Enumeration values for ClientEnableState
const (
	EndpointModeStateUnset EndpointModeState = iota
	EndpointModeStateIPv4
	EndpointModeStateIPv6
)

// SetFromString sets the EndpointModeState based on the provided string value. Unknown values will default to EndpointModeStateUnset
func (e *EndpointModeState) SetFromString(v string) error {
	v = strings.TrimSpace(v)

	switch {
	case len(v) == 0:
		*e = EndpointModeStateUnset
	case strings.EqualFold(v, "IPv6"):
		*e = EndpointModeStateIPv6
	case strings.EqualFold(v, "IPv4"):
		*e = EndpointModeStateIPv4
	default:
		return fmt.Errorf("unknown EC2 IMDS endpoint mode, must be either IPv6 or IPv4")
	}
	return nil
}

// ClientEnableStateResolver is a config resolver interface for retrieving whether the IMDS client is disabled.
type ClientEnableStateResolver interface {
	GetEC2IMDSClientEnableState() (ClientEnableState, bool, error)
}

// EndpointModeResolver is a config resolver interface for retrieving the EndpointModeState configuration.
type EndpointModeResolver interface {
	GetEC2IMDSEndpointMode() (EndpointModeState, bool, error)
}

// EndpointResolver is a config resolver interface for retrieving the endpoint.
type EndpointResolver interface {
	GetEC2IMDSEndpoint() (string, bool, error)
}

type v1FallbackDisabledResolver interface {
	GetEC2IMDSV1FallbackDisabled() (bool, bool)
}

// ResolveClientEnableState resolves the ClientEnableState from a list of configuration sources.
func ResolveClientEnableState(sources []interface{}) (value ClientEnableState, found bool, err error) {
	for _, source := range sources {
		if resolver, ok := source.(ClientEnableStateResolver); ok {
			value, found, err = resolver.GetEC2IMDSClientEnableState()
			if err != nil || found {
				return value, found, err
			}
		}
	}
	return value, found, err
}

// ResolveEndpointModeConfig resolves the EndpointModeState from a list of configuration sources.
func ResolveEndpointModeConfig(sources []interface{}) (value EndpointModeState, found bool, err error) {
	for _, source := range sources {
		if resolver, ok := source.(EndpointModeResolver); ok {
			value, found, err = resolver.GetEC2IMDSEndpointMode()
			if err != nil || found {
				return value, found, err
			}
		}
	}
	return value, found, err
}

// ResolveEndpointConfig resolves the endpoint from a list of configuration sources.
func ResolveEndpointConfig(sources []interface{}) (value string, found bool, err error) {
	for _, source := range sources {
		if resolver, ok := source.(EndpointResolver); ok {
			value, found, err = resolver.GetEC2IMDSEndpoint()
			if err != nil || found {
				return value, found, err
			}
		}
	}
	return value, found, err
}

// ResolveV1FallbackDisabled ...
func ResolveV1FallbackDisabled(sources []interface{}) (bool, bool) {
	for _, source := range sources {
		if resolver, ok := source.(v1FallbackDisabledResolver); ok {
			if v, found := resolver.GetEC2IMDSV1FallbackDisabled(); found {
				return v, true
			}
		}
	}
	return false, false
}
