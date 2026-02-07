package network

import (
	"errors"
	"fmt"
	"net"

	"github.com/docker/docker/internal/multierror"
)

// EndpointSettings stores the network endpoint details
type EndpointSettings struct {
	// Configurations
	IPAMConfig *EndpointIPAMConfig
	Links      []string
	Aliases    []string // Aliases holds the list of extra, user-specified DNS names for this endpoint.
	// MacAddress may be used to specify a MAC address when the container is created.
	// Once the container is running, it becomes operational data (it may contain a
	// generated address).
	MacAddress string
	DriverOpts map[string]string

	// GwPriority determines which endpoint will provide the default gateway
	// for the container. The endpoint with the highest priority will be used.
	// If multiple endpoints have the same priority, they are lexicographically
	// sorted based on their network name, and the one that sorts first is picked.
	GwPriority int
	// Operational data
	NetworkID           string
	EndpointID          string
	Gateway             string
	IPAddress           string
	IPPrefixLen         int
	IPv6Gateway         string
	GlobalIPv6Address   string
	GlobalIPv6PrefixLen int
	// DNSNames holds all the (non fully qualified) DNS names associated to this endpoint. First entry is used to
	// generate PTR records.
	DNSNames []string
}

// Copy makes a deep copy of `EndpointSettings`
func (es *EndpointSettings) Copy() *EndpointSettings {
	epCopy := *es
	if es.IPAMConfig != nil {
		epCopy.IPAMConfig = es.IPAMConfig.Copy()
	}

	if es.Links != nil {
		links := make([]string, 0, len(es.Links))
		epCopy.Links = append(links, es.Links...)
	}

	if es.Aliases != nil {
		aliases := make([]string, 0, len(es.Aliases))
		epCopy.Aliases = append(aliases, es.Aliases...)
	}

	if len(es.DNSNames) > 0 {
		epCopy.DNSNames = make([]string, len(es.DNSNames))
		copy(epCopy.DNSNames, es.DNSNames)
	}

	return &epCopy
}

// EndpointIPAMConfig represents IPAM configurations for the endpoint
type EndpointIPAMConfig struct {
	IPv4Address  string   `json:",omitempty"`
	IPv6Address  string   `json:",omitempty"`
	LinkLocalIPs []string `json:",omitempty"`
}

// Copy makes a copy of the endpoint ipam config
func (cfg *EndpointIPAMConfig) Copy() *EndpointIPAMConfig {
	cfgCopy := *cfg
	cfgCopy.LinkLocalIPs = make([]string, 0, len(cfg.LinkLocalIPs))
	cfgCopy.LinkLocalIPs = append(cfgCopy.LinkLocalIPs, cfg.LinkLocalIPs...)
	return &cfgCopy
}

// NetworkSubnet describes a user-defined subnet for a specific network. It's only used to validate if an
// EndpointIPAMConfig is valid for a specific network.
type NetworkSubnet interface {
	// Contains checks whether the NetworkSubnet contains [addr].
	Contains(addr net.IP) bool
	// IsStatic checks whether the subnet was statically allocated (ie. user-defined).
	IsStatic() bool
}

// IsInRange checks whether static IP addresses are valid in a specific network.
func (cfg *EndpointIPAMConfig) IsInRange(v4Subnets []NetworkSubnet, v6Subnets []NetworkSubnet) error {
	var errs []error

	if err := validateEndpointIPAddress(cfg.IPv4Address, v4Subnets); err != nil {
		errs = append(errs, err)
	}
	if err := validateEndpointIPAddress(cfg.IPv6Address, v6Subnets); err != nil {
		errs = append(errs, err)
	}

	return multierror.Join(errs...)
}

func validateEndpointIPAddress(epAddr string, ipamSubnets []NetworkSubnet) error {
	if epAddr == "" {
		return nil
	}

	var staticSubnet bool
	parsedAddr := net.ParseIP(epAddr)
	for _, subnet := range ipamSubnets {
		if subnet.IsStatic() {
			staticSubnet = true
			if subnet.Contains(parsedAddr) {
				return nil
			}
		}
	}

	if staticSubnet {
		return fmt.Errorf("no configured subnet or ip-range contain the IP address %s", epAddr)
	}

	return errors.New("user specified IP address is supported only when connecting to networks with user configured subnets")
}

// Validate checks whether cfg is valid.
func (cfg *EndpointIPAMConfig) Validate() error {
	if cfg == nil {
		return nil
	}

	var errs []error

	if cfg.IPv4Address != "" {
		if addr := net.ParseIP(cfg.IPv4Address); addr == nil || addr.To4() == nil || addr.IsUnspecified() {
			errs = append(errs, fmt.Errorf("invalid IPv4 address: %s", cfg.IPv4Address))
		}
	}
	if cfg.IPv6Address != "" {
		if addr := net.ParseIP(cfg.IPv6Address); addr == nil || addr.To4() != nil || addr.IsUnspecified() {
			errs = append(errs, fmt.Errorf("invalid IPv6 address: %s", cfg.IPv6Address))
		}
	}
	for _, addr := range cfg.LinkLocalIPs {
		if parsed := net.ParseIP(addr); parsed == nil || parsed.IsUnspecified() {
			errs = append(errs, fmt.Errorf("invalid link-local IP address: %s", addr))
		}
	}

	return multierror.Join(errs...)
}
