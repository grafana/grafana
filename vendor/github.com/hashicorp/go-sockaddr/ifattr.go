package sockaddr

import (
	"fmt"
	"net"
)

// IfAddr is a union of a SockAddr and a net.Interface.
type IfAddr struct {
	SockAddr
	net.Interface
}

// Attr returns the named attribute as a string
func (ifAddr IfAddr) Attr(attrName AttrName) (string, error) {
	val := IfAddrAttr(ifAddr, attrName)
	if val != "" {
		return val, nil
	}

	return Attr(ifAddr.SockAddr, attrName)
}

// Attr returns the named attribute as a string
func Attr(sa SockAddr, attrName AttrName) (string, error) {
	switch sockType := sa.Type(); {
	case sockType&TypeIP != 0:
		ip := *ToIPAddr(sa)
		attrVal := IPAddrAttr(ip, attrName)
		if attrVal != "" {
			return attrVal, nil
		}

		if sockType == TypeIPv4 {
			ipv4 := *ToIPv4Addr(sa)
			attrVal := IPv4AddrAttr(ipv4, attrName)
			if attrVal != "" {
				return attrVal, nil
			}
		} else if sockType == TypeIPv6 {
			ipv6 := *ToIPv6Addr(sa)
			attrVal := IPv6AddrAttr(ipv6, attrName)
			if attrVal != "" {
				return attrVal, nil
			}
		}

	case sockType == TypeUnix:
		us := *ToUnixSock(sa)
		attrVal := UnixSockAttr(us, attrName)
		if attrVal != "" {
			return attrVal, nil
		}
	}

	// Non type-specific attributes
	switch attrName {
	case "string":
		return sa.String(), nil
	case "type":
		return sa.Type().String(), nil
	}

	return "", fmt.Errorf("unsupported attribute name %q", attrName)
}
