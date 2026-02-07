package netutil

import (
	"fmt"
	"net"
	"net/netip"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
)

var (
	getInterfaceAddrs = (*net.Interface).Addrs
)

// PrivateNetworkInterfaces lists network interfaces and returns those having an address conformant to RFC1918
func PrivateNetworkInterfaces(logger log.Logger) []string {
	ints, err := net.Interfaces()
	if err != nil {
		level.Warn(logger).Log("msg", "error getting network interfaces", "err", err)
	}
	return privateNetworkInterfaces(ints, []string{}, logger)
}

func PrivateNetworkInterfacesWithFallback(fallback []string, logger log.Logger) []string {
	ints, err := net.Interfaces()
	if err != nil {
		level.Warn(logger).Log("msg", "error getting network interfaces", "err", err)
	}
	return privateNetworkInterfaces(ints, fallback, logger)
}

// private testable function that checks each given interface
func privateNetworkInterfaces(all []net.Interface, fallback []string, logger log.Logger) []string {
	var privInts []string
	for _, i := range all {
		addrs, err := getInterfaceAddrs(&i)
		if err != nil {
			level.Warn(logger).Log("msg", "error getting addresses from network interface", "interface", i.Name, "err", err)
		}
		for _, a := range addrs {
			s := a.String()
			ip, _, err := net.ParseCIDR(s)
			if err != nil {
				level.Warn(logger).Log("msg", "error parsing network interface IP address", "interface", i.Name, "addr", s, "err", err)
				continue
			}
			if ip.IsPrivate() {
				privInts = append(privInts, i.Name)
				break
			}
		}
	}
	if len(privInts) == 0 {
		return fallback
	}
	return privInts
}

// GetFirstAddressOf returns the first IPv4/IPV6 address of the supplied interface names, omitting any link-local addresses.
func GetFirstAddressOf(names []string, logger log.Logger, enableInet6 bool) (string, error) {
	return getFirstAddressOf(names, logger, getInterfaceAddresses, enableInet6)
}

// NetworkInterfaceAddressGetter matches the signature of net.InterfaceByName() to allow for test mocks.
type NetworkInterfaceAddressGetter func(name string) ([]netip.Addr, error)

// getFirstAddressOf returns the first IPv4/IPV6 address of the supplied interface names, omitting any link-local addresses.
func getFirstAddressOf(names []string, logger log.Logger, interfaceAddrsFunc NetworkInterfaceAddressGetter, enableInet6 bool) (string, error) {
	var ipAddr netip.Addr

	// When passing an empty list of interface names, we select all interfaces.
	if len(names) == 0 {
		infs, err := net.Interfaces()
		if err != nil {
			return "", fmt.Errorf("failed to get interface list and no interface names supplied: %w", err)
		}
		names = make([]string, len(infs))
		for i, v := range infs {
			names[i] = v.Name
		}
	}

	level.Debug(logger).Log("msg", "looking for addresses", "inf", fmt.Sprintf("%s", names), "inet6enabled", enableInet6)

	for _, name := range names {
		addrs, err := interfaceAddrsFunc(name)
		if err != nil {
			level.Warn(logger).Log("msg", "error getting addresses for interface", "inf", name, "err", err)
			continue
		}

		if len(addrs) <= 0 {
			level.Warn(logger).Log("msg", "no addresses found for interface", "inf", name, "err", err)
			continue
		}
		if ip := filterBestIP(addrs, enableInet6); ip.IsValid() {
			// Select the best between what we've received
			ipAddr = filterBestIP([]netip.Addr{ip, ipAddr}, enableInet6)
		}
		level.Debug(logger).Log("msg", "detected highest quality address", "ipAddr", ipAddr.String(), "inf", name)
		if ipAddr.IsLinkLocalUnicast() || !ipAddr.IsValid() {
			level.Debug(logger).Log("msg", "ignoring address", "ipAddr", ipAddr.String(), "inf", name)
			continue
		}

		if enableInet6 {
			if ipAddr.Is6() {
				return ipAddr.String(), nil
			}
			continue
		}

		return ipAddr.String(), nil
	}

	level.Debug(logger).Log("msg", "detected IP address after looking up all configured interface names", "ipAddr", ipAddr.String())
	if !ipAddr.IsValid() {
		return "", fmt.Errorf("no useable address found for interfaces %s", names)
	}
	if ipAddr.IsLinkLocalUnicast() {
		level.Warn(logger).Log("msg", "using link-local address", "address", ipAddr.String())
	}
	return ipAddr.String(), nil
}

// getInterfaceAddresses is the standard approach to collecting []net.Addr from a network interface by name.
func getInterfaceAddresses(name string) ([]netip.Addr, error) {
	inf, err := net.InterfaceByName(name)
	if err != nil {
		return nil, err
	}

	addrs, err := inf.Addrs()
	if err != nil {
		return nil, err
	}

	// Using netip.Addr to allow for easier and consistent address parsing.
	// Without this, the net.ParseCIDR() that we might like to use in a test does
	// not have the same net.Addr implementation that we get from calling
	// interface.Addrs() as above.  Here we normalize on netip.Addr.
	netaddrs := make([]netip.Addr, len(addrs))
	for i, a := range addrs {
		prefix, err := netip.ParsePrefix(a.String())
		if err != nil {
			return nil, errors.Wrap(err, "failed to parse netip.Prefix")
		}
		netaddrs[i] = prefix.Addr()
	}

	return netaddrs, nil
}

// filterBestIP returns an opinionated "best" address from a list of addresses.
// A high quality address is one that is considered routable, and not in the link-local address space.
// A low quality address is a link-local address.
// When an IPv6 is enabled using enableInet6, an IPv6 will be preferred over an equivalent quality IPv4 address,
// otherwise IPv6 addresses are guaranteed to not be returned from this function.
// Loopback addresses are never selected.
func filterBestIP(addrs []netip.Addr, enableInet6 bool) netip.Addr {
	var invalid, inet4Addr, inet6Addr netip.Addr

	for _, addr := range addrs {
		if addr.IsLoopback() || !addr.IsValid() {
			continue
		}

		if addr.Is6() && !enableInet6 {
			continue
		}

		if addr.Is4() {
			// If we have already been set, can we improve on the quality?
			if inet4Addr.IsValid() {
				if inet4Addr.IsLinkLocalUnicast() && !addr.IsLinkLocalUnicast() {
					inet4Addr = addr
				}
				continue
			}
			inet4Addr = addr
		}

		if addr.Is6() {
			// If we have already been set, can we improve on the quality?
			if inet6Addr.IsValid() {
				if inet6Addr.IsLinkLocalUnicast() && !addr.IsLinkLocalUnicast() {
					inet6Addr = addr
				}
				continue
			}
			inet6Addr = addr
		}
	}

	// If both address families have been set, compare.
	if inet4Addr.IsValid() && inet6Addr.IsValid() {
		if inet4Addr.IsLinkLocalUnicast() && !inet6Addr.IsLinkLocalUnicast() {
			return inet6Addr
		}
		if inet6Addr.IsLinkLocalUnicast() && !inet4Addr.IsLinkLocalUnicast() {
			return inet4Addr
		}
		if enableInet6 {
			return inet6Addr
		}
		return inet4Addr
	}

	if inet4Addr.IsValid() {
		return inet4Addr
	}

	if inet6Addr.IsValid() {
		return inet6Addr
	}

	return invalid
}
