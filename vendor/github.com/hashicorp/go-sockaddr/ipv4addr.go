package sockaddr

import (
	"encoding/binary"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
)

type (
	// IPv4Address is a named type representing an IPv4 address.
	IPv4Address uint32

	// IPv4Network is a named type representing an IPv4 network.
	IPv4Network uint32

	// IPv4Mask is a named type representing an IPv4 network mask.
	IPv4Mask uint32
)

// IPv4HostMask is a constant represents a /32 IPv4 Address
// (i.e. 255.255.255.255).
const IPv4HostMask = IPv4Mask(0xffffffff)

// ipv4AddrAttrMap is a map of the IPv4Addr type-specific attributes.
var ipv4AddrAttrMap map[AttrName]func(IPv4Addr) string
var ipv4AddrAttrs []AttrName
var trailingHexNetmaskRE *regexp.Regexp

// IPv4Addr implements a convenience wrapper around the union of Go's
// built-in net.IP and net.IPNet types.  In UNIX-speak, IPv4Addr implements
// `sockaddr` when the the address family is set to AF_INET
// (i.e. `sockaddr_in`).
type IPv4Addr struct {
	IPAddr
	Address IPv4Address
	Mask    IPv4Mask
	Port    IPPort
}

func init() {
	ipv4AddrInit()
	trailingHexNetmaskRE = regexp.MustCompile(`/([0f]{8})$`)
}

// NewIPv4Addr creates an IPv4Addr from a string.  String can be in the form
// of either an IPv4:port (e.g. `1.2.3.4:80`, in which case the mask is
// assumed to be a `/32`), an IPv4 address (e.g. `1.2.3.4`, also with a `/32`
// mask), or an IPv4 CIDR (e.g. `1.2.3.4/24`, which has its IP port
// initialized to zero).  ipv4Str can not be a hostname.
//
// NOTE: Many net.*() routines will initialize and return an IPv6 address.
// To create uint32 values from net.IP, always test to make sure the address
// returned can be converted to a 4 byte array using To4().
func NewIPv4Addr(ipv4Str string) (IPv4Addr, error) {
	// Strip off any bogus hex-encoded netmasks that will be mis-parsed by Go.  In
	// particular, clients with the Barracuda VPN client will see something like:
	// `192.168.3.51/00ffffff` as their IP address.
	trailingHexNetmaskRe := trailingHexNetmaskRE.Copy()
	if match := trailingHexNetmaskRe.FindStringIndex(ipv4Str); match != nil {
		ipv4Str = ipv4Str[:match[0]]
	}

	// Parse as an IPv4 CIDR
	ipAddr, network, err := net.ParseCIDR(ipv4Str)
	if err == nil {
		ipv4 := ipAddr.To4()
		if ipv4 == nil {
			return IPv4Addr{}, fmt.Errorf("Unable to convert %s to an IPv4 address", ipv4Str)
		}

		// If we see an IPv6 netmask, convert it to an IPv4 mask.
		netmaskSepPos := strings.LastIndexByte(ipv4Str, '/')
		if netmaskSepPos != -1 && netmaskSepPos+1 < len(ipv4Str) {
			netMask, err := strconv.ParseUint(ipv4Str[netmaskSepPos+1:], 10, 8)
			if err != nil {
				return IPv4Addr{}, fmt.Errorf("Unable to convert %s to an IPv4 address: unable to parse CIDR netmask: %v", ipv4Str, err)
			} else if netMask > 128 {
				return IPv4Addr{}, fmt.Errorf("Unable to convert %s to an IPv4 address: invalid CIDR netmask", ipv4Str)
			}

			if netMask >= 96 {
				// Convert the IPv6 netmask to an IPv4 netmask
				network.Mask = net.CIDRMask(int(netMask-96), IPv4len*8)
			}
		}
		ipv4Addr := IPv4Addr{
			Address: IPv4Address(binary.BigEndian.Uint32(ipv4)),
			Mask:    IPv4Mask(binary.BigEndian.Uint32(network.Mask)),
		}
		return ipv4Addr, nil
	}

	// Attempt to parse ipv4Str as a /32 host with a port number.
	tcpAddr, err := net.ResolveTCPAddr("tcp4", ipv4Str)
	if err == nil {
		ipv4 := tcpAddr.IP.To4()
		if ipv4 == nil {
			return IPv4Addr{}, fmt.Errorf("Unable to resolve %+q as an IPv4 address", ipv4Str)
		}

		ipv4Uint32 := binary.BigEndian.Uint32(ipv4)
		ipv4Addr := IPv4Addr{
			Address: IPv4Address(ipv4Uint32),
			Mask:    IPv4HostMask,
			Port:    IPPort(tcpAddr.Port),
		}

		return ipv4Addr, nil
	}

	// Parse as a naked IPv4 address
	ip := net.ParseIP(ipv4Str)
	if ip != nil {
		ipv4 := ip.To4()
		if ipv4 == nil {
			return IPv4Addr{}, fmt.Errorf("Unable to string convert %+q to an IPv4 address", ipv4Str)
		}

		ipv4Uint32 := binary.BigEndian.Uint32(ipv4)
		ipv4Addr := IPv4Addr{
			Address: IPv4Address(ipv4Uint32),
			Mask:    IPv4HostMask,
		}
		return ipv4Addr, nil
	}

	return IPv4Addr{}, fmt.Errorf("Unable to parse %+q to an IPv4 address: %v", ipv4Str, err)
}

// AddressBinString returns a string with the IPv4Addr's Address represented
// as a sequence of '0' and '1' characters.  This method is useful for
// debugging or by operators who want to inspect an address.
func (ipv4 IPv4Addr) AddressBinString() string {
	return fmt.Sprintf("%032s", strconv.FormatUint(uint64(ipv4.Address), 2))
}

// AddressHexString returns a string with the IPv4Addr address represented as
// a sequence of hex characters.  This method is useful for debugging or by
// operators who want to inspect an address.
func (ipv4 IPv4Addr) AddressHexString() string {
	return fmt.Sprintf("%08s", strconv.FormatUint(uint64(ipv4.Address), 16))
}

// Broadcast is an IPv4Addr-only method that returns the broadcast address of
// the network.
//
// NOTE: IPv6 only supports multicast, so this method only exists for
// IPv4Addr.
func (ipv4 IPv4Addr) Broadcast() IPAddr {
	// Nothing should listen on a broadcast address.
	return IPv4Addr{
		Address: IPv4Address(ipv4.BroadcastAddress()),
		Mask:    IPv4HostMask,
	}
}

// BroadcastAddress returns a IPv4Network of the IPv4Addr's broadcast
// address.
func (ipv4 IPv4Addr) BroadcastAddress() IPv4Network {
	return IPv4Network(uint32(ipv4.Address)&uint32(ipv4.Mask) | ^uint32(ipv4.Mask))
}

// CmpAddress follows the Cmp() standard protocol and returns:
//
// - -1 If the receiver should sort first because its address is lower than arg
// - 0 if the SockAddr arg is equal to the receiving IPv4Addr or the argument is
//   of a different type.
// - 1 If the argument should sort first.
func (ipv4 IPv4Addr) CmpAddress(sa SockAddr) int {
	ipv4b, ok := sa.(IPv4Addr)
	if !ok {
		return sortDeferDecision
	}

	switch {
	case ipv4.Address == ipv4b.Address:
		return sortDeferDecision
	case ipv4.Address < ipv4b.Address:
		return sortReceiverBeforeArg
	default:
		return sortArgBeforeReceiver
	}
}

// CmpPort follows the Cmp() standard protocol and returns:
//
// - -1 If the receiver should sort first because its port is lower than arg
// - 0 if the SockAddr arg's port number is equal to the receiving IPv4Addr,
//   regardless of type.
// - 1 If the argument should sort first.
func (ipv4 IPv4Addr) CmpPort(sa SockAddr) int {
	var saPort IPPort
	switch v := sa.(type) {
	case IPv4Addr:
		saPort = v.Port
	case IPv6Addr:
		saPort = v.Port
	default:
		return sortDeferDecision
	}

	switch {
	case ipv4.Port == saPort:
		return sortDeferDecision
	case ipv4.Port < saPort:
		return sortReceiverBeforeArg
	default:
		return sortArgBeforeReceiver
	}
}

// CmpRFC follows the Cmp() standard protocol and returns:
//
// - -1 If the receiver should sort first because it belongs to the RFC and its
//   arg does not
// - 0 if the receiver and arg both belong to the same RFC or neither do.
// - 1 If the arg belongs to the RFC but receiver does not.
func (ipv4 IPv4Addr) CmpRFC(rfcNum uint, sa SockAddr) int {
	recvInRFC := IsRFC(rfcNum, ipv4)
	ipv4b, ok := sa.(IPv4Addr)
	if !ok {
		// If the receiver is part of the desired RFC and the SockAddr
		// argument is not, return -1 so that the receiver sorts before
		// the non-IPv4 SockAddr.  Conversely, if the receiver is not
		// part of the RFC, punt on sorting and leave it for the next
		// sorter.
		if recvInRFC {
			return sortReceiverBeforeArg
		} else {
			return sortDeferDecision
		}
	}

	argInRFC := IsRFC(rfcNum, ipv4b)
	switch {
	case (recvInRFC && argInRFC), (!recvInRFC && !argInRFC):
		// If a and b both belong to the RFC, or neither belong to
		// rfcNum, defer sorting to the next sorter.
		return sortDeferDecision
	case recvInRFC && !argInRFC:
		return sortReceiverBeforeArg
	default:
		return sortArgBeforeReceiver
	}
}

// Contains returns true if the SockAddr is contained within the receiver.
func (ipv4 IPv4Addr) Contains(sa SockAddr) bool {
	ipv4b, ok := sa.(IPv4Addr)
	if !ok {
		return false
	}

	return ipv4.ContainsNetwork(ipv4b)
}

// ContainsAddress returns true if the IPv4Address is contained within the
// receiver.
func (ipv4 IPv4Addr) ContainsAddress(x IPv4Address) bool {
	return IPv4Address(ipv4.NetworkAddress()) <= x &&
		IPv4Address(ipv4.BroadcastAddress()) >= x
}

// ContainsNetwork returns true if the network from IPv4Addr is contained
// within the receiver.
func (ipv4 IPv4Addr) ContainsNetwork(x IPv4Addr) bool {
	return ipv4.NetworkAddress() <= x.NetworkAddress() &&
		ipv4.BroadcastAddress() >= x.BroadcastAddress()
}

// DialPacketArgs returns the arguments required to be passed to
// net.DialUDP().  If the Mask of ipv4 is not a /32 or the Port is 0,
// DialPacketArgs() will fail.  See Host() to create an IPv4Addr with its
// mask set to /32.
func (ipv4 IPv4Addr) DialPacketArgs() (network, dialArgs string) {
	if ipv4.Mask != IPv4HostMask || ipv4.Port == 0 {
		return "udp4", ""
	}
	return "udp4", fmt.Sprintf("%s:%d", ipv4.NetIP().String(), ipv4.Port)
}

// DialStreamArgs returns the arguments required to be passed to
// net.DialTCP().  If the Mask of ipv4 is not a /32 or the Port is 0,
// DialStreamArgs() will fail.  See Host() to create an IPv4Addr with its
// mask set to /32.
func (ipv4 IPv4Addr) DialStreamArgs() (network, dialArgs string) {
	if ipv4.Mask != IPv4HostMask || ipv4.Port == 0 {
		return "tcp4", ""
	}
	return "tcp4", fmt.Sprintf("%s:%d", ipv4.NetIP().String(), ipv4.Port)
}

// Equal returns true if a SockAddr is equal to the receiving IPv4Addr.
func (ipv4 IPv4Addr) Equal(sa SockAddr) bool {
	ipv4b, ok := sa.(IPv4Addr)
	if !ok {
		return false
	}

	if ipv4.Port != ipv4b.Port {
		return false
	}

	if ipv4.Address != ipv4b.Address {
		return false
	}

	if ipv4.NetIPNet().String() != ipv4b.NetIPNet().String() {
		return false
	}

	return true
}

// FirstUsable returns an IPv4Addr set to the first address following the
// network prefix.  The first usable address in a network is normally the
// gateway and should not be used except by devices forwarding packets
// between two administratively distinct networks (i.e. a router).  This
// function does not discriminate against first usable vs "first address that
// should be used."  For example, FirstUsable() on "192.168.1.10/24" would
// return the address "192.168.1.1/24".
func (ipv4 IPv4Addr) FirstUsable() IPAddr {
	addr := ipv4.NetworkAddress()

	// If /32, return the address itself. If /31 assume a point-to-point
	// link and return the lower address.
	if ipv4.Maskbits() < 31 {
		addr++
	}

	return IPv4Addr{
		Address: IPv4Address(addr),
		Mask:    IPv4HostMask,
	}
}

// Host returns a copy of ipv4 with its mask set to /32 so that it can be
// used by DialPacketArgs(), DialStreamArgs(), ListenPacketArgs(), or
// ListenStreamArgs().
func (ipv4 IPv4Addr) Host() IPAddr {
	// Nothing should listen on a broadcast address.
	return IPv4Addr{
		Address: ipv4.Address,
		Mask:    IPv4HostMask,
		Port:    ipv4.Port,
	}
}

// IPPort returns the Port number attached to the IPv4Addr
func (ipv4 IPv4Addr) IPPort() IPPort {
	return ipv4.Port
}

// LastUsable returns the last address before the broadcast address in a
// given network.
func (ipv4 IPv4Addr) LastUsable() IPAddr {
	addr := ipv4.BroadcastAddress()

	// If /32, return the address itself. If /31 assume a point-to-point
	// link and return the upper address.
	if ipv4.Maskbits() < 31 {
		addr--
	}

	return IPv4Addr{
		Address: IPv4Address(addr),
		Mask:    IPv4HostMask,
	}
}

// ListenPacketArgs returns the arguments required to be passed to
// net.ListenUDP().  If the Mask of ipv4 is not a /32, ListenPacketArgs()
// will fail.  See Host() to create an IPv4Addr with its mask set to /32.
func (ipv4 IPv4Addr) ListenPacketArgs() (network, listenArgs string) {
	if ipv4.Mask != IPv4HostMask {
		return "udp4", ""
	}
	return "udp4", fmt.Sprintf("%s:%d", ipv4.NetIP().String(), ipv4.Port)
}

// ListenStreamArgs returns the arguments required to be passed to
// net.ListenTCP().  If the Mask of ipv4 is not a /32, ListenStreamArgs()
// will fail.  See Host() to create an IPv4Addr with its mask set to /32.
func (ipv4 IPv4Addr) ListenStreamArgs() (network, listenArgs string) {
	if ipv4.Mask != IPv4HostMask {
		return "tcp4", ""
	}
	return "tcp4", fmt.Sprintf("%s:%d", ipv4.NetIP().String(), ipv4.Port)
}

// Maskbits returns the number of network mask bits in a given IPv4Addr.  For
// example, the Maskbits() of "192.168.1.1/24" would return 24.
func (ipv4 IPv4Addr) Maskbits() int {
	mask := make(net.IPMask, IPv4len)
	binary.BigEndian.PutUint32(mask, uint32(ipv4.Mask))
	maskOnes, _ := mask.Size()
	return maskOnes
}

// MustIPv4Addr is a helper method that must return an IPv4Addr or panic on
// invalid input.
func MustIPv4Addr(addr string) IPv4Addr {
	ipv4, err := NewIPv4Addr(addr)
	if err != nil {
		panic(fmt.Sprintf("Unable to create an IPv4Addr from %+q: %v", addr, err))
	}
	return ipv4
}

// NetIP returns the address as a net.IP (address is always presized to
// IPv4).
func (ipv4 IPv4Addr) NetIP() *net.IP {
	x := make(net.IP, IPv4len)
	binary.BigEndian.PutUint32(x, uint32(ipv4.Address))
	return &x
}

// NetIPMask create a new net.IPMask from the IPv4Addr.
func (ipv4 IPv4Addr) NetIPMask() *net.IPMask {
	ipv4Mask := net.IPMask{}
	ipv4Mask = make(net.IPMask, IPv4len)
	binary.BigEndian.PutUint32(ipv4Mask, uint32(ipv4.Mask))
	return &ipv4Mask
}

// NetIPNet create a new net.IPNet from the IPv4Addr.
func (ipv4 IPv4Addr) NetIPNet() *net.IPNet {
	ipv4net := &net.IPNet{}
	ipv4net.IP = make(net.IP, IPv4len)
	binary.BigEndian.PutUint32(ipv4net.IP, uint32(ipv4.NetworkAddress()))
	ipv4net.Mask = *ipv4.NetIPMask()
	return ipv4net
}

// Network returns the network prefix or network address for a given network.
func (ipv4 IPv4Addr) Network() IPAddr {
	return IPv4Addr{
		Address: IPv4Address(ipv4.NetworkAddress()),
		Mask:    ipv4.Mask,
	}
}

// NetworkAddress returns an IPv4Network of the IPv4Addr's network address.
func (ipv4 IPv4Addr) NetworkAddress() IPv4Network {
	return IPv4Network(uint32(ipv4.Address) & uint32(ipv4.Mask))
}

// Octets returns a slice of the four octets in an IPv4Addr's Address.  The
// order of the bytes is big endian.
func (ipv4 IPv4Addr) Octets() []int {
	return []int{
		int(ipv4.Address >> 24),
		int((ipv4.Address >> 16) & 0xff),
		int((ipv4.Address >> 8) & 0xff),
		int(ipv4.Address & 0xff),
	}
}

// String returns a string representation of the IPv4Addr
func (ipv4 IPv4Addr) String() string {
	if ipv4.Port != 0 {
		return fmt.Sprintf("%s:%d", ipv4.NetIP().String(), ipv4.Port)
	}

	if ipv4.Maskbits() == 32 {
		return ipv4.NetIP().String()
	}

	return fmt.Sprintf("%s/%d", ipv4.NetIP().String(), ipv4.Maskbits())
}

// Type is used as a type switch and returns TypeIPv4
func (IPv4Addr) Type() SockAddrType {
	return TypeIPv4
}

// IPv4AddrAttr returns a string representation of an attribute for the given
// IPv4Addr.
func IPv4AddrAttr(ipv4 IPv4Addr, selector AttrName) string {
	fn, found := ipv4AddrAttrMap[selector]
	if !found {
		return ""
	}

	return fn(ipv4)
}

// IPv4Attrs returns a list of attributes supported by the IPv4Addr type
func IPv4Attrs() []AttrName {
	return ipv4AddrAttrs
}

// ipv4AddrInit is called once at init()
func ipv4AddrInit() {
	// Sorted for human readability
	ipv4AddrAttrs = []AttrName{
		"size", // Same position as in IPv6 for output consistency
		"broadcast",
		"uint32",
	}

	ipv4AddrAttrMap = map[AttrName]func(ipv4 IPv4Addr) string{
		"broadcast": func(ipv4 IPv4Addr) string {
			return ipv4.Broadcast().String()
		},
		"size": func(ipv4 IPv4Addr) string {
			return fmt.Sprintf("%d", 1<<uint(IPv4len*8-ipv4.Maskbits()))
		},
		"uint32": func(ipv4 IPv4Addr) string {
			return fmt.Sprintf("%d", uint32(ipv4.Address))
		},
	}
}
