package sockaddr

import (
	"fmt"
	"strings"
)

type UnixSock struct {
	SockAddr
	path string
}
type UnixSocks []*UnixSock

// unixAttrMap is a map of the UnixSockAddr type-specific attributes.
var unixAttrMap map[AttrName]func(UnixSock) string
var unixAttrs []AttrName

func init() {
	unixAttrInit()
}

// NewUnixSock creates an UnixSock from a string path.  String can be in the
// form of either URI-based string (e.g. `file:///etc/passwd`), an absolute
// path (e.g. `/etc/passwd`), or a relative path (e.g. `./foo`).
func NewUnixSock(s string) (ret UnixSock, err error) {
	ret.path = s
	return ret, nil
}

// Contains returns true if sa and us have the same path
func (us UnixSock) Contains(sa SockAddr) bool {
	usb, ok := sa.(UnixSock)
	if !ok {
		return false
	}

	return usb.path == us.path
}

// CmpAddress follows the Cmp() standard protocol and returns:
//
// - -1 If the receiver should sort first because its name lexically sorts before arg
// - 0 if the SockAddr arg is not a UnixSock, or is a UnixSock with the same path.
// - 1 If the argument should sort first.
func (us UnixSock) CmpAddress(sa SockAddr) int {
	usb, ok := sa.(UnixSock)
	if !ok {
		return sortDeferDecision
	}

	return strings.Compare(us.Path(), usb.Path())
}

// CmpRFC doesn't make sense for a Unix socket, so just return defer decision
func (us UnixSock) CmpRFC(rfcNum uint, sa SockAddr) int { return sortDeferDecision }

// DialPacketArgs returns the arguments required to be passed to net.DialUnix()
// with the `unixgram` network type.
func (us UnixSock) DialPacketArgs() (network, dialArgs string) {
	return "unixgram", us.path
}

// DialStreamArgs returns the arguments required to be passed to net.DialUnix()
// with the `unix` network type.
func (us UnixSock) DialStreamArgs() (network, dialArgs string) {
	return "unix", us.path
}

// Equal returns true if a SockAddr is equal to the receiving UnixSock.
func (us UnixSock) Equal(sa SockAddr) bool {
	usb, ok := sa.(UnixSock)
	if !ok {
		return false
	}

	if us.Path() != usb.Path() {
		return false
	}

	return true
}

// ListenPacketArgs returns the arguments required to be passed to
// net.ListenUnixgram() with the `unixgram` network type.
func (us UnixSock) ListenPacketArgs() (network, dialArgs string) {
	return "unixgram", us.path
}

// ListenStreamArgs returns the arguments required to be passed to
// net.ListenUnix() with the `unix` network type.
func (us UnixSock) ListenStreamArgs() (network, dialArgs string) {
	return "unix", us.path
}

// MustUnixSock is a helper method that must return an UnixSock or panic on
// invalid input.
func MustUnixSock(addr string) UnixSock {
	us, err := NewUnixSock(addr)
	if err != nil {
		panic(fmt.Sprintf("Unable to create a UnixSock from %+q: %v", addr, err))
	}
	return us
}

// Path returns the given path of the UnixSock
func (us UnixSock) Path() string {
	return us.path
}

// String returns the path of the UnixSock
func (us UnixSock) String() string {
	return fmt.Sprintf("%+q", us.path)
}

// Type is used as a type switch and returns TypeUnix
func (UnixSock) Type() SockAddrType {
	return TypeUnix
}

// UnixSockAttrs returns a list of attributes supported by the UnixSockAddr type
func UnixSockAttrs() []AttrName {
	return unixAttrs
}

// UnixSockAttr returns a string representation of an attribute for the given
// UnixSock.
func UnixSockAttr(us UnixSock, attrName AttrName) string {
	fn, found := unixAttrMap[attrName]
	if !found {
		return ""
	}

	return fn(us)
}

// unixAttrInit is called once at init()
func unixAttrInit() {
	// Sorted for human readability
	unixAttrs = []AttrName{
		"path",
	}

	unixAttrMap = map[AttrName]func(us UnixSock) string{
		"path": func(us UnixSock) string {
			return us.Path()
		},
	}
}
