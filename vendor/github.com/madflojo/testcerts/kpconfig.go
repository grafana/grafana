package testcerts

import (
	"errors"
	"math/big"
	"net"
)

var (
	// ErrEmptyConfig is returned when a KeyPairConfig is empty.
	ErrEmptyConfig = errors.New("empty KeyPairConfig")

	// ErrInvalidIP is returned when an IP address is invalid.
	ErrInvalidIP = errors.New("invalid IP address")
)

// KeyPairConfig is a configuration for generating an X.509 key pair.
type KeyPairConfig struct {
	// Domains is a list of domains to include in the certificate as Subject
	// Alternative Names.
	Domains []string

	// IPAddresses is a list of IP addresses to include in the certificate
	// as Subject Alternative Names.
	IPAddresses []string

	// SerialNumber is the serial number to use for the certificate.
	SerialNumber *big.Int

	// CommonName is the Common Name to use for the certificate.
	CommonName string
}

// Validate validates the KeyPairConfig ensuring that it is not empty and that
// provided values are valid.
func (c *KeyPairConfig) Validate() error {
	// Check if the config is empty.
	if len(c.Domains) == 0 && len(c.IPAddresses) == 0 {
		return ErrEmptyConfig
	}

	// Validate IP addresses.
	for _, ip := range c.IPAddresses {
		if net.ParseIP(ip) == nil {
			return ErrInvalidIP
		}
	}

	return nil
}

// IPAddresses returns a list of IP addresses in Net.IP format.
func (c *KeyPairConfig) IPNetAddresses() ([]net.IP, error) {
	var ips []net.IP
	for _, ip := range c.IPAddresses {
		parsed := net.ParseIP(ip)
		if parsed == nil {
			return nil, ErrInvalidIP
		}
		ips = append(ips, parsed)
	}
	return ips, nil
}
