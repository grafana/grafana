//go:build nacl || plan9 || js
// +build nacl plan9 js

package sockaddr

// getDefaultIfName is the default interface function for unsupported platforms.
func getDefaultIfName() (string, error) {
	return "", ErrNoInterface
}

func NewRouteInfo() (routeInfo, error) {
	return routeInfo{}, ErrNoRoute
}

// GetDefaultInterfaceName returns the interface name attached to the default
// route on the default interface.
func (ri routeInfo) GetDefaultInterfaceName() (string, error) {
	return "", ErrNoInterface
}
