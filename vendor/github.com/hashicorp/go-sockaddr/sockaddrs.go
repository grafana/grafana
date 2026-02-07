package sockaddr

import (
	"bytes"
	"sort"
)

// SockAddrs is a slice of SockAddrs
type SockAddrs []SockAddr

func (s SockAddrs) Len() int      { return len(s) }
func (s SockAddrs) Swap(i, j int) { s[i], s[j] = s[j], s[i] }

// CmpAddrFunc is the function signature that must be met to be used in the
// OrderedAddrBy multiAddrSorter
type CmpAddrFunc func(p1, p2 *SockAddr) int

// multiAddrSorter implements the Sort interface, sorting the SockAddrs within.
type multiAddrSorter struct {
	addrs SockAddrs
	cmp   []CmpAddrFunc
}

// Sort sorts the argument slice according to the Cmp functions passed to
// OrderedAddrBy.
func (ms *multiAddrSorter) Sort(sockAddrs SockAddrs) {
	ms.addrs = sockAddrs
	sort.Sort(ms)
}

// OrderedAddrBy sorts SockAddr by the list of sort function pointers.
func OrderedAddrBy(cmpFuncs ...CmpAddrFunc) *multiAddrSorter {
	return &multiAddrSorter{
		cmp: cmpFuncs,
	}
}

// Len is part of sort.Interface.
func (ms *multiAddrSorter) Len() int {
	return len(ms.addrs)
}

// Less is part of sort.Interface. It is implemented by looping along the
// Cmp() functions until it finds a comparison that is either less than,
// equal to, or greater than.
func (ms *multiAddrSorter) Less(i, j int) bool {
	p, q := &ms.addrs[i], &ms.addrs[j]
	// Try all but the last comparison.
	var k int
	for k = 0; k < len(ms.cmp)-1; k++ {
		cmp := ms.cmp[k]
		x := cmp(p, q)
		switch x {
		case -1:
			// p < q, so we have a decision.
			return true
		case 1:
			// p > q, so we have a decision.
			return false
		}
		// p == q; try the next comparison.
	}
	// All comparisons to here said "equal", so just return whatever the
	// final comparison reports.
	switch ms.cmp[k](p, q) {
	case -1:
		return true
	case 1:
		return false
	default:
		// Still a tie! Now what?
		return false
	}
}

// Swap is part of sort.Interface.
func (ms *multiAddrSorter) Swap(i, j int) {
	ms.addrs[i], ms.addrs[j] = ms.addrs[j], ms.addrs[i]
}

const (
	// NOTE (sean@): These constants are here for code readability only and
	// are sprucing up the code for readability purposes.  Some of the
	// Cmp*() variants have confusing logic (especially when dealing with
	// mixed-type comparisons) and this, I think, has made it easier to grok
	// the code faster.
	sortReceiverBeforeArg = -1
	sortDeferDecision     = 0
	sortArgBeforeReceiver = 1
)

// AscAddress is a sorting function to sort SockAddrs by their respective
// address type.  Non-equal types are deferred in the sort.
func AscAddress(p1Ptr, p2Ptr *SockAddr) int {
	p1 := *p1Ptr
	p2 := *p2Ptr

	switch v := p1.(type) {
	case IPv4Addr:
		return v.CmpAddress(p2)
	case IPv6Addr:
		return v.CmpAddress(p2)
	case UnixSock:
		return v.CmpAddress(p2)
	default:
		return sortDeferDecision
	}
}

// AscPort is a sorting function to sort SockAddrs by their respective address
// type.  Non-equal types are deferred in the sort.
func AscPort(p1Ptr, p2Ptr *SockAddr) int {
	p1 := *p1Ptr
	p2 := *p2Ptr

	switch v := p1.(type) {
	case IPv4Addr:
		return v.CmpPort(p2)
	case IPv6Addr:
		return v.CmpPort(p2)
	default:
		return sortDeferDecision
	}
}

// AscPrivate is a sorting function to sort "more secure" private values before
// "more public" values.  Both IPv4 and IPv6 are compared against RFC6890
// (RFC6890 includes, and is not limited to, RFC1918 and RFC6598 for IPv4, and
// IPv6 includes RFC4193).
func AscPrivate(p1Ptr, p2Ptr *SockAddr) int {
	p1 := *p1Ptr
	p2 := *p2Ptr

	switch v := p1.(type) {
	case IPv4Addr, IPv6Addr:
		return v.CmpRFC(6890, p2)
	default:
		return sortDeferDecision
	}
}

// AscNetworkSize is a sorting function to sort SockAddrs based on their network
// size.  Non-equal types are deferred in the sort.
func AscNetworkSize(p1Ptr, p2Ptr *SockAddr) int {
	p1 := *p1Ptr
	p2 := *p2Ptr
	p1Type := p1.Type()
	p2Type := p2.Type()

	// Network size operations on non-IP types make no sense
	if p1Type != p2Type && p1Type != TypeIP {
		return sortDeferDecision
	}

	ipA := p1.(IPAddr)
	ipB := p2.(IPAddr)

	return bytes.Compare([]byte(*ipA.NetIPMask()), []byte(*ipB.NetIPMask()))
}

// AscType is a sorting function to sort "more secure" types before
// "less-secure" types.
func AscType(p1Ptr, p2Ptr *SockAddr) int {
	p1 := *p1Ptr
	p2 := *p2Ptr
	p1Type := p1.Type()
	p2Type := p2.Type()
	switch {
	case p1Type < p2Type:
		return sortReceiverBeforeArg
	case p1Type == p2Type:
		return sortDeferDecision
	case p1Type > p2Type:
		return sortArgBeforeReceiver
	default:
		return sortDeferDecision
	}
}

// FilterByType returns two lists: a list of matched and unmatched SockAddrs
func (sas SockAddrs) FilterByType(type_ SockAddrType) (matched, excluded SockAddrs) {
	matched = make(SockAddrs, 0, len(sas))
	excluded = make(SockAddrs, 0, len(sas))

	for _, sa := range sas {
		if sa.Type()&type_ != 0 {
			matched = append(matched, sa)
		} else {
			excluded = append(excluded, sa)
		}
	}
	return matched, excluded
}
