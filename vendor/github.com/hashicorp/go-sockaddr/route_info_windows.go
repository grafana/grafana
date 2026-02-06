package sockaddr

import (
	"os/exec"
	"strings"
)

var cmds map[string][]string = map[string][]string{
	"defaultInterface": {"powershell", "Get-NetRoute -DestinationPrefix '0.0.0.0/0' | select -ExpandProperty InterfaceAlias"},
	// These commands enable GetDefaultInterfaceNameLegacy and should be removed
	// when it is.
	"netstat":  {"netstat", "-rn"},
	"ipconfig": {"ipconfig"},
}

// NewRouteInfo returns a BSD-specific implementation of the RouteInfo
// interface.
func NewRouteInfo() (routeInfo, error) {
	return routeInfo{
		cmds: cmds,
	}, nil
}

// GetDefaultInterfaceName returns the interface name attached to the default
// route on the default interface.
func (ri routeInfo) GetDefaultInterfaceName() (string, error) {
	if !hasPowershell() {
		// No powershell, fallback to legacy method
		return ri.GetDefaultInterfaceNameLegacy()
	}

	ifNameOut, err := exec.Command(cmds["defaultInterface"][0], cmds["defaultInterface"][1:]...).Output()
	if err != nil {
		return "", err
	}

	ifName := strings.TrimSpace(string(ifNameOut[:]))
	return ifName, nil
}

// GetDefaultInterfaceNameLegacy provides legacy behavior for GetDefaultInterfaceName
// on Windows machines without powershell.
func (ri routeInfo) GetDefaultInterfaceNameLegacy() (string, error) {
	ifNameOut, err := exec.Command(cmds["netstat"][0], cmds["netstat"][1:]...).Output()
	if err != nil {
		return "", err
	}

	ipconfigOut, err := exec.Command(cmds["ipconfig"][0], cmds["ipconfig"][1:]...).Output()
	if err != nil {
		return "", err
	}

	ifName, err := parseDefaultIfNameWindows(string(ifNameOut), string(ipconfigOut))
	if err != nil {
		return "", err
	}

	return ifName, nil
}

func hasPowershell() bool {
	_, err := exec.LookPath("powershell")
	return (err != nil)
}
