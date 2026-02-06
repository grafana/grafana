package proxyproto

// AddressFamilyAndProtocol represents address family and transport protocol.
type AddressFamilyAndProtocol byte

const (
	UNSPEC       AddressFamilyAndProtocol = '\x00'
	TCPv4        AddressFamilyAndProtocol = '\x11'
	UDPv4        AddressFamilyAndProtocol = '\x12'
	TCPv6        AddressFamilyAndProtocol = '\x21'
	UDPv6        AddressFamilyAndProtocol = '\x22'
	UnixStream   AddressFamilyAndProtocol = '\x31'
	UnixDatagram AddressFamilyAndProtocol = '\x32'
)

// IsIPv4 returns true if the address family is IPv4 (AF_INET4), false otherwise.
func (ap AddressFamilyAndProtocol) IsIPv4() bool {
	return ap&0xF0 == 0x10
}

// IsIPv6 returns true if the address family is IPv6 (AF_INET6), false otherwise.
func (ap AddressFamilyAndProtocol) IsIPv6() bool {
	return ap&0xF0 == 0x20
}

// IsUnix returns true if the address family is UNIX (AF_UNIX), false otherwise.
func (ap AddressFamilyAndProtocol) IsUnix() bool {
	return ap&0xF0 == 0x30
}

// IsStream returns true if the transport protocol is TCP or STREAM (SOCK_STREAM), false otherwise.
func (ap AddressFamilyAndProtocol) IsStream() bool {
	return ap&0x0F == 0x01
}

// IsDatagram returns true if the transport protocol is UDP or DGRAM (SOCK_DGRAM), false otherwise.
func (ap AddressFamilyAndProtocol) IsDatagram() bool {
	return ap&0x0F == 0x02
}

// IsUnspec returns true if the transport protocol or address family is unspecified, false otherwise.
func (ap AddressFamilyAndProtocol) IsUnspec() bool {
	return (ap&0xF0 == 0x00) || (ap&0x0F == 0x00)
}

func (ap AddressFamilyAndProtocol) toByte() byte {
	if ap.IsIPv4() && ap.IsStream() {
		return byte(TCPv4)
	} else if ap.IsIPv4() && ap.IsDatagram() {
		return byte(UDPv4)
	} else if ap.IsIPv6() && ap.IsStream() {
		return byte(TCPv6)
	} else if ap.IsIPv6() && ap.IsDatagram() {
		return byte(UDPv6)
	} else if ap.IsUnix() && ap.IsStream() {
		return byte(UnixStream)
	} else if ap.IsUnix() && ap.IsDatagram() {
		return byte(UnixDatagram)
	}

	return byte(UNSPEC)
}
