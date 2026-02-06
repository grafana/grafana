package types

// Reference: https://www.ietf.org/rfc/rfc4120.txt
// Section: 5.2.5

import (
	"bytes"
	"fmt"
	"net"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/iana/addrtype"
)

// HostAddresses implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.5
type HostAddresses []HostAddress

// HostAddress implements RFC 4120 type: https://tools.ietf.org/html/rfc4120#section-5.2.5
type HostAddress struct {
	AddrType int32  `asn1:"explicit,tag:0"`
	Address  []byte `asn1:"explicit,tag:1"`
}

// GetHostAddress returns a HostAddress struct from a string in the format <hostname>:<port>
func GetHostAddress(s string) (HostAddress, error) {
	var h HostAddress
	cAddr, _, err := net.SplitHostPort(s)
	if err != nil {
		return h, fmt.Errorf("invalid format of client address: %v", err)
	}
	ip := net.ParseIP(cAddr)
	var ht int32
	if ip.To4() != nil {
		ht = addrtype.IPv4
		ip = ip.To4()
	} else if ip.To16() != nil {
		ht = addrtype.IPv6
		ip = ip.To16()
	} else {
		return h, fmt.Errorf("could not determine client's address types: %v", err)
	}
	h = HostAddress{
		AddrType: ht,
		Address:  ip,
	}
	return h, nil
}

// GetAddress returns a string representation of the HostAddress.
func (h *HostAddress) GetAddress() (string, error) {
	var b []byte
	_, err := asn1.Unmarshal(h.Address, &b)
	return string(b), err
}

// LocalHostAddresses returns a HostAddresses struct for the local machines interface IP addresses.
func LocalHostAddresses() (ha HostAddresses, err error) {
	ifs, err := net.Interfaces()
	if err != nil {
		return
	}
	for _, iface := range ifs {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			// Interface is either loopback of not up
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			var a HostAddress
			if ip.To16() == nil {
				//neither IPv4 or IPv6
				continue
			}
			if ip.To4() != nil {
				//Is IPv4
				a.AddrType = addrtype.IPv4
				a.Address = ip.To4()
			} else {
				a.AddrType = addrtype.IPv6
				a.Address = ip.To16()
			}
			ha = append(ha, a)
		}
	}
	return ha, nil
}

// HostAddressesFromNetIPs returns a HostAddresses type from a slice of net.IP
func HostAddressesFromNetIPs(ips []net.IP) (ha HostAddresses) {
	for _, ip := range ips {
		ha = append(ha, HostAddressFromNetIP(ip))
	}
	return ha
}

// HostAddressFromNetIP returns a HostAddress type from a net.IP
func HostAddressFromNetIP(ip net.IP) HostAddress {
	if ip.To4() != nil {
		//Is IPv4
		return HostAddress{
			AddrType: addrtype.IPv4,
			Address:  ip.To4(),
		}
	}
	return HostAddress{
		AddrType: addrtype.IPv6,
		Address:  ip.To16(),
	}
}

// HostAddressesEqual tests if two HostAddress slices are equal.
func HostAddressesEqual(h, a []HostAddress) bool {
	if len(h) != len(a) {
		return false
	}
	for _, e := range a {
		var found bool
		for _, i := range h {
			if e.Equal(i) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// HostAddressesContains tests if a HostAddress is contained in a HostAddress slice.
func HostAddressesContains(h []HostAddress, a HostAddress) bool {
	for _, e := range h {
		if e.Equal(a) {
			return true
		}
	}
	return false
}

// Equal tests if the HostAddress is equal to another HostAddress provided.
func (h *HostAddress) Equal(a HostAddress) bool {
	if h.AddrType != a.AddrType {
		return false
	}
	return bytes.Equal(h.Address, a.Address)
}

// Contains tests if a HostAddress is contained within the HostAddresses struct.
func (h *HostAddresses) Contains(a HostAddress) bool {
	for _, e := range *h {
		if e.Equal(a) {
			return true
		}
	}
	return false
}

// Equal tests if a HostAddress slice is equal to the HostAddresses struct.
func (h *HostAddresses) Equal(a []HostAddress) bool {
	if len(*h) != len(a) {
		return false
	}
	for _, e := range a {
		if !h.Contains(e) {
			return false
		}
	}
	return true
}
