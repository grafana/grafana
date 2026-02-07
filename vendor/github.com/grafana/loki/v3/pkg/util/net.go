package util

import (
	"fmt"
	"net"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

// GetFirstAddressOf returns the first IPv4 address of the supplied interface names, omitting any 169.254.x.x automatic private IPs if possible.
func GetFirstAddressOf(names []string, logger log.Logger) (string, error) {
	var ipAddr string
	for _, name := range names {
		inf, err := net.InterfaceByName(name)
		if err != nil {
			level.Warn(logger).Log("msg", "error getting interface", "inf", name, "err", err)
			continue
		}
		addrs, err := inf.Addrs()
		if err != nil {
			level.Warn(logger).Log("msg", "error getting addresses for interface", "inf", name, "err", err)
			continue
		}
		if len(addrs) <= 0 {
			level.Warn(logger).Log("msg", "no addresses found for interface", "inf", name, "err", err)
			continue
		}
		if ip := filterIPs(addrs); ip != "" {
			ipAddr = ip
		}
		if strings.HasPrefix(ipAddr, `169.254.`) || ipAddr == "" {
			continue
		}
		return ipAddr, nil
	}
	if ipAddr == "" {
		return "", fmt.Errorf("no address found for %s", names)
	}
	if strings.HasPrefix(ipAddr, `169.254.`) {
		level.Warn(logger).Log("msg", "using automatic private ip", "address", ipAddr)
	}
	return ipAddr, nil
}

// filterIPs attempts to return the first non automatic private IP (APIPA / 169.254.x.x) if possible, only returning APIPA if available and no other valid IP is found.
func filterIPs(addrs []net.Addr) string {
	var ipAddr string
	for _, addr := range addrs {
		if v, ok := addr.(*net.IPNet); ok {
			if ip := v.IP.To4(); ip != nil {
				ipAddr = v.IP.String()
				if !strings.HasPrefix(ipAddr, `169.254.`) {
					return ipAddr
				}
			}
		}
	}
	return ipAddr
}
