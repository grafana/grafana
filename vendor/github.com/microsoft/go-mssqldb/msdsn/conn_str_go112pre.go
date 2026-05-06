//go:build !go1.12
// +build !go1.12

package msdsn

import "crypto/tls"

func TLSVersionFromString(minTLSVersion string) uint16 {
	switch minTLSVersion {
	case "1.0":
		return tls.VersionTLS10
	case "1.1":
		return tls.VersionTLS11
	case "1.2":
		return tls.VersionTLS12
	default:
		// use the tls package default
	}
	return 0
}
