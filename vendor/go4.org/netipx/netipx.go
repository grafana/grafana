// Copyright 2020 The Inet.Af AUTHORS. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package netipx contains code and types that were left behind when
// the old inet.af/netaddr package moved to the standard library in Go
// 1.18 as net/netip.
package netipx // import "go4.org/netipx"

import (
	"errors"
	"fmt"
	"math"
	"net"
	"net/netip"
	"sort"
	"strings"
)

// FromStdIP returns an IP from the standard library's IP type.
//
// If std is invalid, ok is false.
//
// FromStdIP implicitly unmaps IPv6-mapped IPv4 addresses. That is, if
// len(std) == 16 and contains an IPv4 address, only the IPv4 part is
// returned, without the IPv6 wrapper. This is the common form returned by
// the standard library's ParseIP: https://play.golang.org/p/qdjylUkKWxl.
// To convert a standard library IP without the implicit unmapping, use
// netip.AddrFromSlice.
func FromStdIP(std net.IP) (ip netip.Addr, ok bool) {
	ret, ok := netip.AddrFromSlice(std)
	return ret.Unmap(), ok
}

// MustFromStdIP is like FromStdIP, but it panics if std is invalid.
func MustFromStdIP(std net.IP) netip.Addr {
	ret, ok := netip.AddrFromSlice(std)
	if !ok {
		panic("not a valid IP address")
	}
	return ret.Unmap()
}

// FromStdIPRaw returns an IP from the standard library's IP type.
// If std is invalid, ok is false.
// Unlike FromStdIP, FromStdIPRaw does not do an implicit Unmap if
// len(std) == 16 and contains an IPv6-mapped IPv4 address.
//
// Deprecated: use netip.AddrFromSlice instead.
func FromStdIPRaw(std net.IP) (ip netip.Addr, ok bool) {
	return netip.AddrFromSlice(std)
}

// AddrNext returns the IP following ip.
// If there is none, it returns the IP zero value.
//
// Deprecated: use netip.Addr.Next instead.
func AddrNext(ip netip.Addr) netip.Addr {
	addr := u128From16(ip.As16()).addOne()
	if ip.Is4() {
		if uint32(addr.lo) == 0 {
			// Overflowed.
			return netip.Addr{}
		}
		return addr.IP4()
	} else {
		if addr.isZero() {
			// Overflowed
			return netip.Addr{}
		}
		return addr.IP6().WithZone(ip.Zone())
	}
}

// AddrPrior returns the IP before ip.
// If there is none, it returns the IP zero value.
//
// Deprecated: use netip.Addr.Prev instead.
func AddrPrior(ip netip.Addr) netip.Addr {
	addr := u128From16(ip.As16())
	if ip.Is4() {
		if uint32(addr.lo) == 0 {
			return netip.Addr{}
		}
		return addr.subOne().IP4()
	} else {
		if addr.isZero() {
			return netip.Addr{}
		}
		return addr.subOne().IP6().WithZone(ip.Zone())
	}
}

// FromStdAddr maps the components of a standard library TCPAddr or
// UDPAddr into an IPPort.
func FromStdAddr(stdIP net.IP, port int, zone string) (_ netip.AddrPort, ok bool) {
	ip, ok := FromStdIP(stdIP)
	if !ok || port < 0 || port > math.MaxUint16 {
		return netip.AddrPort{}, false
	}
	ip = ip.Unmap()
	if zone != "" {
		if ip.Is4() {
			ok = false
			return
		}
		ip = ip.WithZone(zone)
	}
	return netip.AddrPortFrom(ip, uint16(port)), true
}

// FromStdIPNet returns an netip.Prefix from the standard library's IPNet type.
// If std is invalid, ok is false.
func FromStdIPNet(std *net.IPNet) (prefix netip.Prefix, ok bool) {
	ip, ok := FromStdIP(std.IP)
	if !ok {
		return netip.Prefix{}, false
	}

	if l := len(std.Mask); l != net.IPv4len && l != net.IPv6len {
		// Invalid mask.
		return netip.Prefix{}, false
	}

	ones, bits := std.Mask.Size()
	if ones == 0 && bits == 0 {
		// IPPrefix does not support non-contiguous masks.
		return netip.Prefix{}, false
	}

	return netip.PrefixFrom(ip, ones), true
}

// RangeOfPrefix returns the inclusive range of IPs that p covers.
//
// If p is zero or otherwise invalid, Range returns the zero value.
func RangeOfPrefix(p netip.Prefix) IPRange {
	p = p.Masked()
	if !p.IsValid() {
		return IPRange{}
	}
	return IPRangeFrom(p.Addr(), PrefixLastIP(p))
}

// PrefixIPNet returns the net.IPNet representation of an netip.Prefix.
// The returned value is always non-nil.
// Any zone identifier is dropped in the conversion.
func PrefixIPNet(p netip.Prefix) *net.IPNet {
	if !p.IsValid() {
		return &net.IPNet{}
	}
	return &net.IPNet{
		IP:   p.Addr().AsSlice(),
		Mask: net.CIDRMask(p.Bits(), p.Addr().BitLen()),
	}
}

// AddrIPNet returns the net.IPNet representation of an netip.Addr
// with a mask corresponding to the addresses's bit length.
// The returned value is always non-nil.
// Any zone identifier is dropped in the conversion.
func AddrIPNet(addr netip.Addr) *net.IPNet {
	if !addr.IsValid() {
		return &net.IPNet{}
	}
	return &net.IPNet{
		IP:   addr.AsSlice(),
		Mask: net.CIDRMask(addr.BitLen(), addr.BitLen()),
	}
}

// PrefixLastIP returns the last IP in the prefix.
func PrefixLastIP(p netip.Prefix) netip.Addr {
	if !p.IsValid() {
		return netip.Addr{}
	}
	a16 := p.Addr().As16()
	var off uint8
	var bits uint8 = 128
	if p.Addr().Is4() {
		off = 12
		bits = 32
	}
	for b := uint8(p.Bits()); b < bits; b++ {
		byteNum, bitInByte := b/8, 7-(b%8)
		a16[off+byteNum] |= 1 << uint(bitInByte)
	}
	if p.Addr().Is4() {
		return netip.AddrFrom16(a16).Unmap()
	} else {
		return netip.AddrFrom16(a16) // doesn't unmap
	}
}

// IPRange represents an inclusive range of IP addresses
// from the same address family.
//
// The From and To IPs are inclusive bounds, with both included in the
// range.
//
// To be valid, the From and To values must be non-zero, have matching
// address families (IPv4 vs IPv6), and From must be less than or equal to To.
// IPv6 zones are stripped out and ignored.
// An invalid range may be ignored.
type IPRange struct {
	// from is the initial IP address in the range.
	from netip.Addr

	// to is the final IP address in the range.
	to netip.Addr
}

// IPRangeFrom returns an IPRange from from to to.
// It does not allocate.
func IPRangeFrom(from, to netip.Addr) IPRange {
	return IPRange{
		from: from.WithZone(""),
		to:   to.WithZone(""),
	}
}

// From returns the lower bound of r.
func (r IPRange) From() netip.Addr { return r.from }

// To returns the upper bound of r.
func (r IPRange) To() netip.Addr { return r.to }

// ParseIPRange parses a range out of two IPs separated by a hyphen.
//
// It returns an error if the range is not valid.
func ParseIPRange(s string) (IPRange, error) {
	var r IPRange
	h := strings.IndexByte(s, '-')
	if h == -1 {
		return r, fmt.Errorf("no hyphen in range %q", s)
	}
	from, to := s[:h], s[h+1:]
	var err error
	r.from, err = netip.ParseAddr(from)
	if err != nil {
		return r, fmt.Errorf("invalid From IP %q in range %q", from, s)
	}
	r.from = r.from.WithZone("")
	r.to, err = netip.ParseAddr(to)
	if err != nil {
		return r, fmt.Errorf("invalid To IP %q in range %q", to, s)
	}
	r.to = r.to.WithZone("")
	if !r.IsValid() {
		return r, fmt.Errorf("range %v to %v not valid", r.from, r.to)
	}
	return r, nil
}

// MustParseIPRange calls ParseIPRange(s) and panics on error.
// It is intended for use in tests with hard-coded strings.
func MustParseIPRange(s string) IPRange {
	r, err := ParseIPRange(s)
	if err != nil {
		panic(err)
	}
	return r
}

// String returns a string representation of the range.
//
// For a valid range, the form is "From-To" with a single hyphen
// separating the IPs, the same format recognized by
// ParseIPRange.
func (r IPRange) String() string {
	if r.IsValid() {
		return fmt.Sprintf("%s-%s", r.from, r.to)
	}
	if !r.from.IsValid() || !r.to.IsValid() {
		return "zero IPRange"
	}
	return "invalid IPRange"
}

// AppendTo appends a text encoding of r,
// as generated by MarshalText,
// to b and returns the extended buffer.
func (r IPRange) AppendTo(b []byte) []byte {
	if r.IsZero() {
		return b
	}
	b = r.from.AppendTo(b)
	b = append(b, '-')
	b = r.to.AppendTo(b)
	return b
}

// MarshalText implements the encoding.TextMarshaler interface,
// The encoding is the same as returned by String, with one exception:
// If ip is the zero value, the encoding is the empty string.
func (r IPRange) MarshalText() ([]byte, error) {
	if r.IsZero() {
		return []byte(""), nil
	}
	var max int
	if r.from.Is4() {
		max = len("255.255.255.255-255.255.255.255")
	} else {
		max = len("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")
	}
	b := make([]byte, 0, max)
	return r.AppendTo(b), nil
}

// UnmarshalText implements the encoding.TextUnmarshaler interface.
// The IP range is expected in a form accepted by ParseIPRange.
// It returns an error if *r is not the IPRange zero value.
func (r *IPRange) UnmarshalText(text []byte) error {
	if *r != (IPRange{}) {
		return errors.New("refusing to Unmarshal into non-zero IPRange")
	}
	if len(text) == 0 {
		return nil
	}
	var err error
	*r, err = ParseIPRange(string(text))
	return err
}

// IsZero reports whether r is the zero value of the IPRange type.
func (r IPRange) IsZero() bool {
	return r == IPRange{}
}

// IsValid reports whether r.From() and r.To() are both non-zero and
// obey the documented requirements: address families match, and From
// is less than or equal to To.
func (r IPRange) IsValid() bool {
	return r.from.IsValid() &&
		r.from.BitLen() == r.to.BitLen() &&
		r.from.Zone() == r.to.Zone() &&
		!r.to.Less(r.from)
}

// Valid reports whether r.From() and r.To() are both non-zero and
// obey the documented requirements: address families match, and From
// is less than or equal to To.
//
// Deprecated: use the correctly named and identical IsValid method instead.
func (r IPRange) Valid() bool { return r.IsValid() }

// Contains reports whether the range r includes addr.
//
// An invalid range always reports false.
//
// If ip has an IPv6 zone, Contains returns false,
// because IPPrefixes strip zones.
func (r IPRange) Contains(addr netip.Addr) bool {
	return r.IsValid() && addr.Zone() == "" && r.contains(addr)
}

// contains is like Contains, but without the validity check.
// addr must not have a zone.
func (r IPRange) contains(addr netip.Addr) bool {
	return r.from.Compare(addr) <= 0 && r.to.Compare(addr) >= 0
}

// less reports whether r is "before" other. It is before if r.From()
// is before other.From(). If they're equal, then the larger range
// (higher To()) comes first.
func (r IPRange) less(other IPRange) bool {
	if cmp := r.from.Compare(other.from); cmp != 0 {
		return cmp < 0
	}
	return other.to.Less(r.to)
}

// entirelyBefore returns whether r lies entirely before other in IP
// space.
func (r IPRange) entirelyBefore(other IPRange) bool {
	return r.to.Less(other.from)
}

func lessOrEq(ip, ip2 netip.Addr) bool { return ip.Compare(ip2) <= 0 }

// entirelyWithin returns whether r is entirely contained within
// other.
func (r IPRange) coveredBy(other IPRange) bool {
	return lessOrEq(other.from, r.from) && lessOrEq(r.to, other.to)
}

// inMiddleOf returns whether r is inside other, but not touching the
// edges of other.
func (r IPRange) inMiddleOf(other IPRange) bool {
	return other.from.Less(r.from) && r.to.Less(other.to)
}

// overlapsStartOf returns whether r entirely overlaps the start of
// other, but not all of other.
func (r IPRange) overlapsStartOf(other IPRange) bool {
	return lessOrEq(r.from, other.from) && r.to.Less(other.to)
}

// overlapsEndOf returns whether r entirely overlaps the end of
// other, but not all of other.
func (r IPRange) overlapsEndOf(other IPRange) bool {
	return other.from.Less(r.from) && lessOrEq(other.to, r.to)
}

// mergeIPRanges returns the minimum and sorted set of IP ranges that
// cover r.
func mergeIPRanges(rr []IPRange) (out []IPRange, valid bool) {
	// Always return a copy of r, to avoid aliasing slice memory in
	// the caller.
	switch len(rr) {
	case 0:
		return nil, true
	case 1:
		return []IPRange{rr[0]}, true
	}

	sort.Slice(rr, func(i, j int) bool { return rr[i].less(rr[j]) })
	out = make([]IPRange, 1, len(rr))
	out[0] = rr[0]
	for _, r := range rr[1:] {
		prev := &out[len(out)-1]
		switch {
		case !r.IsValid():
			// Invalid ranges make no sense to merge, refuse to
			// perform.
			return nil, false
		case prev.to.Next() == r.from:
			// prev and r touch, merge them.
			//
			//   prev     r
			// f------tf-----t
			prev.to = r.to
		case prev.to.Less(r.from):
			// No overlap and not adjacent (per previous case), no
			// merging possible.
			//
			//   prev       r
			// f------t  f-----t
			out = append(out, r)
		case prev.to.Less(r.to):
			// Partial overlap, update prev
			//
			//   prev
			// f------t
			//     f-----t
			//        r
			prev.to = r.to
		default:
			// r entirely contained in prev, nothing to do.
			//
			//    prev
			// f--------t
			//  f-----t
			//     r
		}
	}
	return out, true
}

// Overlaps reports whether p and o overlap at all.
//
// If p and o are of different address families or either are invalid,
// it reports false.
func (r IPRange) Overlaps(o IPRange) bool {
	return r.IsValid() &&
		o.IsValid() &&
		r.from.Compare(o.to) <= 0 &&
		o.from.Compare(r.to) <= 0
}

// prefixMaker returns a address-family-corrected IPPrefix from a and bits,
// where the input bits is always in the IPv6-mapped form for IPv4 addresses.
type prefixMaker func(a uint128, bits uint8) netip.Prefix

// Prefixes returns the set of IPPrefix entries that covers r.
//
// If either of r's bounds are invalid, in the wrong order, or if
// they're of different address families, then Prefixes returns nil.
//
// Prefixes necessarily allocates. See AppendPrefixes for a version that uses
// memory you provide.
func (r IPRange) Prefixes() []netip.Prefix {
	return r.AppendPrefixes(nil)
}

// AppendPrefixes is an append version of IPRange.Prefixes. It appends
// the netip.Prefix entries that cover r to dst.
func (r IPRange) AppendPrefixes(dst []netip.Prefix) []netip.Prefix {
	if !r.IsValid() {
		return nil
	}
	return appendRangePrefixes(dst, r.prefixFrom128AndBits, u128From16(r.from.As16()), u128From16(r.to.As16()))
}

func (r IPRange) prefixFrom128AndBits(a uint128, bits uint8) netip.Prefix {
	var ip netip.Addr
	if r.from.Is4() {
		bits -= 12 * 8
		ip = a.IP4()
	} else {
		ip = a.IP6()
	}
	return netip.PrefixFrom(ip, int(bits))
}

// aZeroBSet is whether, after the common bits, a is all zero bits and
// b is all set (one) bits.
func comparePrefixes(a, b uint128) (common uint8, aZeroBSet bool) {
	common = a.commonPrefixLen(b)

	// See whether a and b, after their common shared bits, end
	// in all zero bits or all one bits, respectively.
	if common == 128 {
		return common, true
	}

	m := mask6[common]
	return common, (a.xor(a.and(m)).isZero() &&
		b.or(m) == uint128{^uint64(0), ^uint64(0)})
}

// Prefix returns r as an IPPrefix, if it can be presented exactly as such.
// If r is not valid or is not exactly equal to one prefix, ok is false.
func (r IPRange) Prefix() (p netip.Prefix, ok bool) {
	if !r.IsValid() {
		return
	}
	from128 := u128From16(r.from.As16())
	to128 := u128From16(r.to.As16())
	if common, ok := comparePrefixes(from128, to128); ok {
		return r.prefixFrom128AndBits(from128, common), true
	}
	return
}

func appendRangePrefixes(dst []netip.Prefix, makePrefix prefixMaker, a, b uint128) []netip.Prefix {
	common, ok := comparePrefixes(a, b)
	if ok {
		// a to b represents a whole range, like 10.50.0.0/16.
		// (a being 10.50.0.0 and b being 10.50.255.255)
		return append(dst, makePrefix(a, common))
	}
	// Otherwise recursively do both halves.
	dst = appendRangePrefixes(dst, makePrefix, a, a.bitsSetFrom(common+1))
	dst = appendRangePrefixes(dst, makePrefix, b.bitsClearedFrom(common+1), b)
	return dst
}
