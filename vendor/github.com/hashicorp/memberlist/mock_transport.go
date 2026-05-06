// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package memberlist

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"strconv"
	"time"
)

// MockNetwork is used as a factory that produces MockTransport instances which
// are uniquely addressed and wired up to talk to each other.
type MockNetwork struct {
	transportsByAddr map[string]*MockTransport
	transportsByName map[string]*MockTransport
	port             int
}

// NewTransport returns a new MockTransport with a unique address, wired up to
// talk to the other transports in the MockNetwork.
func (n *MockNetwork) NewTransport(name string) *MockTransport {
	n.port += 1
	addr := fmt.Sprintf("127.0.0.1:%d", n.port)
	transport := &MockTransport{
		net:      n,
		addr:     &MockAddress{addr, name},
		packetCh: make(chan *Packet),
		streamCh: make(chan net.Conn),
	}

	if n.transportsByAddr == nil {
		n.transportsByAddr = make(map[string]*MockTransport)
	}
	n.transportsByAddr[addr] = transport

	if n.transportsByName == nil {
		n.transportsByName = make(map[string]*MockTransport)
	}
	n.transportsByName[name] = transport

	return transport
}

// MockAddress is a wrapper which adds the net.Addr interface to our mock
// address scheme.
type MockAddress struct {
	addr string
	name string
}

// See net.Addr.
func (a *MockAddress) Network() string {
	return "mock"
}

// See net.Addr.
func (a *MockAddress) String() string {
	return a.addr
}

// MockTransport directly plumbs messages to other transports its MockNetwork.
type MockTransport struct {
	net      *MockNetwork
	addr     *MockAddress
	packetCh chan *Packet
	streamCh chan net.Conn
}

var _ NodeAwareTransport = (*MockTransport)(nil)

// See Transport.
func (t *MockTransport) FinalAdvertiseAddr(string, int) (net.IP, int, error) {
	host, portStr, err := net.SplitHostPort(t.addr.String())
	if err != nil {
		return nil, 0, err
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return nil, 0, fmt.Errorf("Failed to parse IP %q", host)
	}

	port, err := strconv.ParseInt(portStr, 10, 16)
	if err != nil {
		return nil, 0, err
	}

	return ip, int(port), nil
}

// See Transport.
func (t *MockTransport) WriteTo(b []byte, addr string) (time.Time, error) {
	a := Address{Addr: addr, Name: ""}
	return t.WriteToAddress(b, a)
}

// See NodeAwareTransport.
func (t *MockTransport) WriteToAddress(b []byte, a Address) (time.Time, error) {
	dest, err := t.getPeer(a)
	if err != nil {
		return time.Time{}, err
	}

	now := time.Now()
	dest.packetCh <- &Packet{
		Buf:       b,
		From:      t.addr,
		Timestamp: now,
	}
	return now, nil
}

// See Transport.
func (t *MockTransport) PacketCh() <-chan *Packet {
	return t.packetCh
}

// See NodeAwareTransport.
func (t *MockTransport) IngestPacket(conn net.Conn, addr net.Addr, now time.Time, shouldClose bool) error {
	if shouldClose {
		defer conn.Close()
	}

	// Copy everything from the stream into packet buffer.
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, conn); err != nil {
		return fmt.Errorf("failed to read packet: %v", err)
	}

	// Check the length - it needs to have at least one byte to be a proper
	// message. This is checked elsewhere for writes coming in directly from
	// the UDP socket.
	if n := buf.Len(); n < 1 {
		return fmt.Errorf("packet too short (%d bytes) %s", n, LogAddress(addr))
	}

	// Inject the packet.
	t.packetCh <- &Packet{
		Buf:       buf.Bytes(),
		From:      addr,
		Timestamp: now,
	}
	return nil
}

// See Transport.
func (t *MockTransport) DialTimeout(addr string, timeout time.Duration) (net.Conn, error) {
	a := Address{Addr: addr, Name: ""}
	return t.DialAddressTimeout(a, timeout)
}

// See NodeAwareTransport.
func (t *MockTransport) DialAddressTimeout(a Address, timeout time.Duration) (net.Conn, error) {
	dest, err := t.getPeer(a)
	if err != nil {
		return nil, err
	}

	p1, p2 := net.Pipe()
	dest.streamCh <- p1
	return p2, nil
}

// See Transport.
func (t *MockTransport) StreamCh() <-chan net.Conn {
	return t.streamCh
}

// See NodeAwareTransport.
func (t *MockTransport) IngestStream(conn net.Conn) error {
	t.streamCh <- conn
	return nil
}

// See Transport.
func (t *MockTransport) Shutdown() error {
	return nil
}

func (t *MockTransport) getPeer(a Address) (*MockTransport, error) {
	var (
		dest *MockTransport
		ok   bool
	)
	if a.Name != "" {
		dest, ok = t.net.transportsByName[a.Name]
	} else {
		dest, ok = t.net.transportsByAddr[a.Addr]
	}
	if !ok {
		return nil, fmt.Errorf("No route to %s", a)
	}
	return dest, nil
}
