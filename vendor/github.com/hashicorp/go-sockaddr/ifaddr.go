package sockaddr

import "strings"

// ifAddrAttrMap is a map of the IfAddr type-specific attributes.
var ifAddrAttrMap map[AttrName]func(IfAddr) string
var ifAddrAttrs []AttrName

func init() {
	ifAddrAttrInit()
}

// GetPrivateIP returns a string with a single IP address that is part of RFC
// 6890 and has a default route.  If the system can't determine its IP address
// or find an RFC 6890 IP address, an empty string will be returned instead.
// This function is the `eval` equivalent of:
//
// ```
// $ sockaddr eval -r '{{GetPrivateInterfaces | attr "address"}}'
/// ```
func GetPrivateIP() (string, error) {
	privateIfs, err := GetPrivateInterfaces()
	if err != nil {
		return "", err
	}
	if len(privateIfs) < 1 {
		return "", nil
	}

	ifAddr := privateIfs[0]
	ip := *ToIPAddr(ifAddr.SockAddr)
	return ip.NetIP().String(), nil
}

// GetPrivateIPs returns a string with all IP addresses that are part of RFC
// 6890 (regardless of whether or not there is a default route, unlike
// GetPublicIP).  If the system can't find any RFC 6890 IP addresses, an empty
// string will be returned instead.  This function is the `eval` equivalent of:
//
// ```
// $ sockaddr eval -r '{{GetAllInterfaces | include "RFC" "6890" | join "address" " "}}'
/// ```
func GetPrivateIPs() (string, error) {
	ifAddrs, err := GetAllInterfaces()
	if err != nil {
		return "", err
	} else if len(ifAddrs) < 1 {
		return "", nil
	}

	ifAddrs, _ = FilterIfByType(ifAddrs, TypeIP)
	if len(ifAddrs) == 0 {
		return "", nil
	}

	OrderedIfAddrBy(AscIfType, AscIfNetworkSize).Sort(ifAddrs)

	ifAddrs, _, err = IfByRFC("6890", ifAddrs)
	if err != nil {
		return "", err
	} else if len(ifAddrs) == 0 {
		return "", nil
	}

	_, ifAddrs, err = IfByRFC(ForwardingBlacklistRFC, ifAddrs)
	if err != nil {
		return "", err
	} else if len(ifAddrs) == 0 {
		return "", nil
	}

	ips := make([]string, 0, len(ifAddrs))
	for _, ifAddr := range ifAddrs {
		ip := *ToIPAddr(ifAddr.SockAddr)
		s := ip.NetIP().String()
		ips = append(ips, s)
	}

	return strings.Join(ips, " "), nil
}

// GetPublicIP returns a string with a single IP address that is NOT part of RFC
// 6890 and has a default route.  If the system can't determine its IP address
// or find a non RFC 6890 IP address, an empty string will be returned instead.
// This function is the `eval` equivalent of:
//
// ```
// $ sockaddr eval -r '{{GetPublicInterfaces | attr "address"}}'
/// ```
func GetPublicIP() (string, error) {
	publicIfs, err := GetPublicInterfaces()
	if err != nil {
		return "", err
	} else if len(publicIfs) < 1 {
		return "", nil
	}

	ifAddr := publicIfs[0]
	ip := *ToIPAddr(ifAddr.SockAddr)
	return ip.NetIP().String(), nil
}

// GetPublicIPs returns a string with all IP addresses that are NOT part of RFC
// 6890 (regardless of whether or not there is a default route, unlike
// GetPublicIP).  If the system can't find any non RFC 6890 IP addresses, an
// empty string will be returned instead.  This function is the `eval`
// equivalent of:
//
// ```
// $ sockaddr eval -r '{{GetAllInterfaces | exclude "RFC" "6890" | join "address" " "}}'
/// ```
func GetPublicIPs() (string, error) {
	ifAddrs, err := GetAllInterfaces()
	if err != nil {
		return "", err
	} else if len(ifAddrs) < 1 {
		return "", nil
	}

	ifAddrs, _ = FilterIfByType(ifAddrs, TypeIP)
	if len(ifAddrs) == 0 {
		return "", nil
	}

	OrderedIfAddrBy(AscIfType, AscIfNetworkSize).Sort(ifAddrs)

	_, ifAddrs, err = IfByRFC("6890", ifAddrs)
	if err != nil {
		return "", err
	} else if len(ifAddrs) == 0 {
		return "", nil
	}

	ips := make([]string, 0, len(ifAddrs))
	for _, ifAddr := range ifAddrs {
		ip := *ToIPAddr(ifAddr.SockAddr)
		s := ip.NetIP().String()
		ips = append(ips, s)
	}

	return strings.Join(ips, " "), nil
}

// GetInterfaceIP returns a string with a single IP address sorted by the size
// of the network (i.e. IP addresses with a smaller netmask, larger network
// size, are sorted first).  This function is the `eval` equivalent of:
//
// ```
// $ sockaddr eval -r '{{GetAllInterfaces | include "name" <<ARG>> | sort "type,size" | include "flag" "forwardable" | attr "address" }}'
/// ```
func GetInterfaceIP(namedIfRE string) (string, error) {
	ifAddrs, err := GetAllInterfaces()
	if err != nil {
		return "", err
	}

	ifAddrs, _, err = IfByName(namedIfRE, ifAddrs)
	if err != nil {
		return "", err
	}

	ifAddrs, _, err = IfByFlag("forwardable", ifAddrs)
	if err != nil {
		return "", err
	}

	ifAddrs, err = SortIfBy("+type,+size", ifAddrs)
	if err != nil {
		return "", err
	}

	if len(ifAddrs) == 0 {
		return "", err
	}

	ip := ToIPAddr(ifAddrs[0].SockAddr)
	if ip == nil {
		return "", err
	}

	return IPAddrAttr(*ip, "address"), nil
}

// GetInterfaceIPs returns a string with all IPs, sorted by the size of the
// network (i.e. IP addresses with a smaller netmask, larger network size, are
// sorted first), on a named interface.  This function is the `eval` equivalent
// of:
//
// ```
// $ sockaddr eval -r '{{GetAllInterfaces | include "name" <<ARG>> | sort "type,size" | join "address" " "}}'
/// ```
func GetInterfaceIPs(namedIfRE string) (string, error) {
	ifAddrs, err := GetAllInterfaces()
	if err != nil {
		return "", err
	}

	ifAddrs, _, err = IfByName(namedIfRE, ifAddrs)
	if err != nil {
		return "", err
	}

	ifAddrs, err = SortIfBy("+type,+size", ifAddrs)
	if err != nil {
		return "", err
	}

	if len(ifAddrs) == 0 {
		return "", err
	}

	ips := make([]string, 0, len(ifAddrs))
	for _, ifAddr := range ifAddrs {
		ip := *ToIPAddr(ifAddr.SockAddr)
		s := ip.NetIP().String()
		ips = append(ips, s)
	}

	return strings.Join(ips, " "), nil
}

// IfAddrAttrs returns a list of attributes supported by the IfAddr type
func IfAddrAttrs() []AttrName {
	return ifAddrAttrs
}

// IfAddrAttr returns a string representation of an attribute for the given
// IfAddr.
func IfAddrAttr(ifAddr IfAddr, attrName AttrName) string {
	fn, found := ifAddrAttrMap[attrName]
	if !found {
		return ""
	}

	return fn(ifAddr)
}

// ifAddrAttrInit is called once at init()
func ifAddrAttrInit() {
	// Sorted for human readability
	ifAddrAttrs = []AttrName{
		"flags",
		"name",
	}

	ifAddrAttrMap = map[AttrName]func(ifAddr IfAddr) string{
		"flags": func(ifAddr IfAddr) string {
			return ifAddr.Interface.Flags.String()
		},
		"name": func(ifAddr IfAddr) string {
			return ifAddr.Interface.Name
		},
	}
}
