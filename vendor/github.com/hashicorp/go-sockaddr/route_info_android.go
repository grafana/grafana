//go:build android

package sockaddr

import (
	"errors"
	"os/exec"
)

// NewRouteInfo returns a Android-specific implementation of the RouteInfo
// interface.
func NewRouteInfo() (routeInfo, error) {
	return routeInfo{
		cmds: map[string][]string{"ip": {"/system/bin/ip", "route", "get", "8.8.8.8"}},
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
	if ifName, err = parseDefaultIfNameFromIPCmdAndroid(string(out)); err != nil {
		return "", errors.New("No default interface found")
	}
	return ifName, nil
}
