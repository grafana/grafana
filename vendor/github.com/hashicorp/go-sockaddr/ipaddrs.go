package sockaddr

import "bytes"

type IPAddrs []IPAddr

func (s IPAddrs) Len() int      { return len(s) }
func (s IPAddrs) Swap(i, j int) { s[i], s[j] = s[j], s[i] }

// // SortIPAddrsByCmp is a type that satisfies sort.Interface and can be used
// // by the routines in this package.  The SortIPAddrsByCmp type is used to
// // sort IPAddrs by Cmp()
// type SortIPAddrsByCmp struct{ IPAddrs }

// // Less reports whether the element with index i should sort before the
// // element with index j.
// func (s SortIPAddrsByCmp) Less(i, j int) bool {
// 	// Sort by Type, then address, then port number.
// 	return Less(s.IPAddrs[i], s.IPAddrs[j])
// }

// SortIPAddrsBySpecificMaskLen is a type that satisfies sort.Interface and
// can be used by the routines in this package.  The
// SortIPAddrsBySpecificMaskLen type is used to sort IPAddrs by smallest
// network (most specific to largest network).
type SortIPAddrsByNetworkSize struct{ IPAddrs }

// Less reports whether the element with index i should sort before the
// element with index j.
func (s SortIPAddrsByNetworkSize) Less(i, j int) bool {
	// Sort masks with a larger binary value (i.e. fewer hosts per network
	// prefix) after masks with a smaller value (larger number of hosts per
	// prefix).
	switch bytes.Compare([]byte(*s.IPAddrs[i].NetIPMask()), []byte(*s.IPAddrs[j].NetIPMask())) {
	case 0:
		// Fall through to the second test if the net.IPMasks are the
		// same.
		break
	case 1:
		return true
	case -1:
		return false
	default:
		panic("bad, m'kay?")
	}

	// Sort IPs based on the length (i.e. prefer IPv4 over IPv6).
	iLen := len(*s.IPAddrs[i].NetIP())
	jLen := len(*s.IPAddrs[j].NetIP())
	if iLen != jLen {
		return iLen > jLen
	}

	// Sort IPs based on their network address from lowest to highest.
	switch bytes.Compare(s.IPAddrs[i].NetIPNet().IP, s.IPAddrs[j].NetIPNet().IP) {
	case 0:
		break
	case 1:
		return false
	case -1:
		return true
	default:
		panic("lol wut?")
	}

	// If a host does not have a port set, it always sorts after hosts
	// that have a port (e.g. a host with a /32 and port number is more
	// specific and should sort first over a host with a /32 but no port
	// set).
	if s.IPAddrs[i].IPPort() == 0 || s.IPAddrs[j].IPPort() == 0 {
		return false
	}
	return s.IPAddrs[i].IPPort() < s.IPAddrs[j].IPPort()
}

// SortIPAddrsBySpecificMaskLen is a type that satisfies sort.Interface and
// can be used by the routines in this package.  The
// SortIPAddrsBySpecificMaskLen type is used to sort IPAddrs by smallest
// network (most specific to largest network).
type SortIPAddrsBySpecificMaskLen struct{ IPAddrs }

// Less reports whether the element with index i should sort before the
// element with index j.
func (s SortIPAddrsBySpecificMaskLen) Less(i, j int) bool {
	return s.IPAddrs[i].Maskbits() > s.IPAddrs[j].Maskbits()
}

// SortIPAddrsByBroadMaskLen is a type that satisfies sort.Interface and can
// be used by the routines in this package.  The SortIPAddrsByBroadMaskLen
// type is used to sort IPAddrs by largest network (i.e. largest subnets
// first).
type SortIPAddrsByBroadMaskLen struct{ IPAddrs }

// Less reports whether the element with index i should sort before the
// element with index j.
func (s SortIPAddrsByBroadMaskLen) Less(i, j int) bool {
	return s.IPAddrs[i].Maskbits() < s.IPAddrs[j].Maskbits()
}
