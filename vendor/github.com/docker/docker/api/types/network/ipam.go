package network

import (
	"errors"
	"fmt"
	"net/netip"

	"github.com/docker/docker/internal/multierror"
)

// IPAM represents IP Address Management
type IPAM struct {
	Driver  string
	Options map[string]string // Per network IPAM driver options
	Config  []IPAMConfig
}

// IPAMConfig represents IPAM configurations
type IPAMConfig struct {
	Subnet     string            `json:",omitempty"`
	IPRange    string            `json:",omitempty"`
	Gateway    string            `json:",omitempty"`
	AuxAddress map[string]string `json:"AuxiliaryAddresses,omitempty"`
}

type ipFamily string

const (
	ip4 ipFamily = "IPv4"
	ip6 ipFamily = "IPv6"
)

// ValidateIPAM checks whether the network's IPAM passed as argument is valid. It returns a joinError of the list of
// errors found.
func ValidateIPAM(ipam *IPAM, enableIPv6 bool) error {
	if ipam == nil {
		return nil
	}

	var errs []error
	for _, cfg := range ipam.Config {
		subnet, err := netip.ParsePrefix(cfg.Subnet)
		if err != nil {
			errs = append(errs, fmt.Errorf("invalid subnet %s: invalid CIDR block notation", cfg.Subnet))
			continue
		}
		subnetFamily := ip4
		if subnet.Addr().Is6() {
			subnetFamily = ip6
		}

		if !enableIPv6 && subnetFamily == ip6 {
			continue
		}

		if subnet != subnet.Masked() {
			errs = append(errs, fmt.Errorf("invalid subnet %s: it should be %s", subnet, subnet.Masked()))
		}

		if ipRangeErrs := validateIPRange(cfg.IPRange, subnet, subnetFamily); len(ipRangeErrs) > 0 {
			errs = append(errs, ipRangeErrs...)
		}

		if err := validateAddress(cfg.Gateway, subnet, subnetFamily); err != nil {
			errs = append(errs, fmt.Errorf("invalid gateway %s: %w", cfg.Gateway, err))
		}

		for auxName, aux := range cfg.AuxAddress {
			if err := validateAddress(aux, subnet, subnetFamily); err != nil {
				errs = append(errs, fmt.Errorf("invalid auxiliary address %s: %w", auxName, err))
			}
		}
	}

	if err := multierror.Join(errs...); err != nil {
		return fmt.Errorf("invalid network config:\n%w", err)
	}

	return nil
}

func validateIPRange(ipRange string, subnet netip.Prefix, subnetFamily ipFamily) []error {
	if ipRange == "" {
		return nil
	}
	prefix, err := netip.ParsePrefix(ipRange)
	if err != nil {
		return []error{fmt.Errorf("invalid ip-range %s: invalid CIDR block notation", ipRange)}
	}
	family := ip4
	if prefix.Addr().Is6() {
		family = ip6
	}

	if family != subnetFamily {
		return []error{fmt.Errorf("invalid ip-range %s: parent subnet is an %s block", ipRange, subnetFamily)}
	}

	var errs []error
	if prefix.Bits() < subnet.Bits() {
		errs = append(errs, fmt.Errorf("invalid ip-range %s: CIDR block is bigger than its parent subnet %s", ipRange, subnet))
	}
	if prefix != prefix.Masked() {
		errs = append(errs, fmt.Errorf("invalid ip-range %s: it should be %s", prefix, prefix.Masked()))
	}
	if !subnet.Overlaps(prefix) {
		errs = append(errs, fmt.Errorf("invalid ip-range %s: parent subnet %s doesn't contain ip-range", ipRange, subnet))
	}

	return errs
}

func validateAddress(address string, subnet netip.Prefix, subnetFamily ipFamily) error {
	if address == "" {
		return nil
	}
	addr, err := netip.ParseAddr(address)
	if err != nil {
		return errors.New("invalid address")
	}
	family := ip4
	if addr.Is6() {
		family = ip6
	}

	if family != subnetFamily {
		return fmt.Errorf("parent subnet is an %s block", subnetFamily)
	}
	if !subnet.Contains(addr) {
		return fmt.Errorf("parent subnet %s doesn't contain this address", subnet)
	}

	return nil
}
