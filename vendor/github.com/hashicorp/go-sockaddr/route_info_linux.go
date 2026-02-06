//go:build !android
// +build !android

package sockaddr

import (
	"errors"
	"os/exec"
)

// NewRouteInfo returns a Linux-specific implementation of the RouteInfo
// interface.
func NewRouteInfo() (routeInfo, error) {
	// CoreOS Container Linux moved ip to /usr/bin/ip, so look it up on
	// $PATH and fallback to /sbin/ip on error.
	path, _ := exec.LookPath("ip")
	if path == "" {
		path = "/sbin/ip"
	}

	return routeInfo{
		cmds: map[string][]string{"ip": {path, "route"}},
	}, nil
}

// GetDefaultInterfaceName returns the interface name attached to the default
// route on the default interface.
func (ri routeInfo) GetDefaultInterfaceName() (string, error) {
	out, err := exec.Command(ri.cmds["ip"][0], ri.cmds["ip"][1:]...).Output()
	if err != nil {
		return "", err
	}

	var ifName string
	if ifName, err = parseDefaultIfNameFromIPCmd(string(out)); err != nil {
		return "", errors.New("No default interface found")
	}
	return ifName, nil
}
