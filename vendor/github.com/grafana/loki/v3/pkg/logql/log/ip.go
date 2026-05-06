package log

import (
	"errors"
	"fmt"
	"net/netip"
	"unicode"

	"go4.org/netipx"
)

var (
	ErrIPFilterInvalidPattern   = errors.New("ip: invalid pattern")
	ErrIPFilterInvalidOperation = errors.New("ip: invalid operation")
)

type IPMatchType int

const (
	IPv4Charset = "0123456789."
	IPv6Charset = "0123456789abcdefABCDEF:."
)

// Should be one of the netip.Addr, netip.Prefix, netipx.IPRange.
type IPMatcher interface{}

type IPLineFilter struct {
	ip *ipFilter
	ty LineMatchType
}

// NewIPLineFilter is used to construct ip filter as a `LineFilter`
func NewIPLineFilter(pattern string, ty LineMatchType) (*IPLineFilter, error) {
	// check if `ty` supported in ip matcher.
	switch ty {
	case LineMatchEqual, LineMatchNotEqual:
	default:
		return nil, ErrIPFilterInvalidOperation
	}

	ip, err := newIPFilter(pattern)
	if err != nil {
		return nil, err
	}
	return &IPLineFilter{
		ip: ip,
		ty: ty,
	}, nil
}

// Filter implement `Filterer` interface. Used by `LineFilter`
func (f *IPLineFilter) Filter(line []byte) bool {
	return f.filterTy(line, f.ty)
}

// ToStage implements `Filterer` interface.
func (f *IPLineFilter) ToStage() Stage {
	return f
}

// `Process` implements `Stage` interface
func (f *IPLineFilter) Process(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
	return line, f.filterTy(line, f.ty)
}

// `RequiredLabelNames` implements `Stage` interface
func (f *IPLineFilter) RequiredLabelNames() []string {
	return []string{} // empty for line filter
}

func (f *IPLineFilter) filterTy(line []byte, ty LineMatchType) bool {
	if ty == LineMatchNotEqual {
		return !f.ip.filter(line)
	}
	return f.ip.filter(line)
}

type IPLabelFilter struct {
	ip *ipFilter
	Ty LabelFilterType

	// if used as Label matcher, this holds the identifier Label name.
	// e.g: (|remote_addr = ip("xxx")). Here labelName is `remote_addr`
	Label string

	// patError records if given pattern is invalid.
	patError error

	// local copy of Pattern to display it in errors, even though Pattern matcher fails because of invalid Pattern.
	Pattern string
}

// NewIPLabelFilter is used to construct ip filter as label filter for the given `label`.
func NewIPLabelFilter(pattern, label string, ty LabelFilterType) *IPLabelFilter {
	ip, err := newIPFilter(pattern)
	return &IPLabelFilter{
		ip:       ip,
		Label:    label,
		Ty:       ty,
		patError: err,
		Pattern:  pattern,
	}
}

// `Process` implements `Stage` interface
func (f *IPLabelFilter) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	return line, f.filterTy(line, f.Ty, lbs)
}

func (f *IPLabelFilter) isLabelFilterer() {}

// `RequiredLabelNames` implements `Stage` interface
func (f *IPLabelFilter) RequiredLabelNames() []string {
	return []string{f.Label}
}

// PatternError will be used `labelFilter.Stage()` method so that, if the given pattern is wrong
// it returns proper 400 error to the client of LogQL.
func (f *IPLabelFilter) PatternError() error {
	return f.patError
}

func (f *IPLabelFilter) filterTy(_ []byte, ty LabelFilterType, lbs *LabelsBuilder) bool {
	if lbs.HasErr() {
		// why `true`?. if there's an error only the string matchers can filter out.
		return true
	}
	input, ok := lbs.Get(f.Label)
	if !ok {
		// we have not found the label.
		return false
	}

	if f.ip == nil {
		return false
	}

	switch ty {
	case LabelFilterEqual:
		return f.ip.filter([]byte(input))
	case LabelFilterNotEqual:
		return !f.ip.filter([]byte(input))
	}
	return false
}

// `String` implements fmt.Stringer inteface, by which also implements `LabelFilterer` inteface.
func (f *IPLabelFilter) String() string {
	eq := "=" // LabelFilterEqual -> "==", we don't want in string representation of ip label filter.
	if f.Ty == LabelFilterNotEqual {
		eq = LabelFilterNotEqual.String()
	}

	return fmt.Sprintf("%s%sip(%q)", f.Label, eq, f.Pattern) // label filter
}

// ipFilter search for IP addresses of given `pattern` in the given `line`.
// It returns true if pattern is matched with at least one IP in the `line`

// pattern - can be of the following form for both IPv4 and IPv6.
// 1. SINGLE-IP - "192.168.0.1"
// 2. IP RANGE  - "192.168.0.1-192.168.0.23"
// 3. CIDR      - "192.168.0.0/16"
type ipFilter struct {
	pattern string
	matcher IPMatcher
}

func newIPFilter(pattern string) (*ipFilter, error) {
	filter := &ipFilter{pattern: pattern}

	matcher, err := getMatcher(pattern)
	if err != nil {
		return nil, err
	}
	filter.matcher = matcher

	return filter, nil
}

// filter does the heavy lifting finding ip `pattern` in the givin `line`.
// This is the function if you want to understand how the core logic how ip filter works!
func (f *ipFilter) filter(line []byte) bool {
	if len(line) == 0 {
		return false
	}

	n := len(line)

	filterFn := func(line []byte, start int, charset string) (bool, int) {
		iplen := bytesSpan(line[start:], []byte(charset))
		if iplen < 0 {
			return false, 0
		}
		ip, err := netip.ParseAddr(string(line[start : start+iplen]))
		if err == nil {
			if containsIP(f.matcher, ip) {
				return true, 0
			}
		}
		return false, iplen
	}

	// This loop try to extract IPv4 or IPv6 address from the arbitrary string.
	// It uses IPv4 and IPv6 prefix hints to find the IP addresses faster without using regexp.
	for i := 0; i < n; i++ {
		if i+3 < n && ipv4Hint([4]byte{line[i], line[i+1], line[i+2], line[i+3]}) {
			ok, iplen := filterFn(line, i, IPv4Charset)
			if ok {
				return true
			}
			i += iplen
			continue
		}

		if i+4 < n && ipv6Hint([5]byte{line[i], line[i+1], line[i+2], line[i+3], line[i+4]}) {
			ok, iplen := filterFn(line, i, IPv6Charset)
			if ok {
				return true
			}
			i += iplen
			continue
		}
	}
	return false
}

func containsIP(matcher IPMatcher, ip netip.Addr) bool {
	switch m := matcher.(type) {
	case netip.Addr:
		return m.Compare(ip) == 0
	case netipx.IPRange:
		return m.Contains(ip)
	case netip.Prefix:
		return m.Contains(ip)
	}
	return false
}

func getMatcher(pattern string) (IPMatcher, error) {
	var (
		matcher IPMatcher
		err     error
	)

	matcher, err = netip.ParseAddr(pattern) // is it simple single IP?
	if err == nil {
		return matcher, nil
	}
	matcher, err = netip.ParsePrefix(pattern) // is it cidr format? (192.168.0.1/16)
	if err == nil {
		return matcher, nil
	}

	matcher, err = netipx.ParseIPRange(pattern) // is it IP range format? (192.168.0.1 - 192.168.4.5
	if err == nil {
		return matcher, nil
	}

	return nil, fmt.Errorf("%w: %q", ErrIPFilterInvalidPattern, pattern)
}

func ipv4Hint(prefix [4]byte) bool {
	return unicode.IsDigit(rune(prefix[0])) && (prefix[1] == '.' || prefix[2] == '.' || prefix[3] == '.')
}

func ipv6Hint(prefix [5]byte) bool {
	hint1 := prefix[0] == ':' && prefix[1] == ':' && isHexDigit(prefix[2])
	hint2 := isHexDigit(prefix[0]) && prefix[1] == ':'
	hint3 := isHexDigit(prefix[0]) && isHexDigit(prefix[1]) && prefix[2] == ':'
	hint4 := isHexDigit(prefix[0]) && isHexDigit(prefix[1]) && isHexDigit(prefix[2]) && prefix[3] == ':'
	hint5 := isHexDigit(prefix[0]) && isHexDigit(prefix[1]) && isHexDigit(prefix[2]) && isHexDigit(prefix[3]) && prefix[4] == ':'

	return hint1 || hint2 || hint3 || hint4 || hint5
}

func isHexDigit(r byte) bool {
	return unicode.IsDigit(rune(r)) || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

// bytesSpan is same as C's `strcspan()` function.
// It returns the number of chars in the initial segment of `s`
// which consist only of chars from `accept`.
func bytesSpan(s, accept []byte) int {
	m := make(map[byte]bool)

	for _, r := range accept {
		m[r] = true
	}

	for i, r := range s {
		if !m[r] {
			return i
		}
	}

	return len(s)
}
