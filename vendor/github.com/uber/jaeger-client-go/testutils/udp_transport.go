// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package testutils

import (
	"bytes"
	"net"
	"sync/atomic"

	"github.com/apache/thrift/lib/go/thrift"
)

const (
	// used in RemainingBytes()
	maxRemainingBytes = ^uint64(0)
)

// TUDPTransport does UDP as a thrift.TTransport (read-only, write functions not implemented).
type TUDPTransport struct {
	conn     *net.UDPConn
	addr     net.Addr
	writeBuf bytes.Buffer
	closed   uint32
}

// NewTUDPServerTransport creates a net.UDPConn-backed TTransport for Thrift servers
// It will listen for incoming udp packets on the specified host/port
// Example:
// 	trans, err := utils.NewTUDPClientTransport("localhost:9001")
func NewTUDPServerTransport(hostPort string) (*TUDPTransport, error) {
	addr, err := net.ResolveUDPAddr("udp", hostPort)
	if err != nil {
		return nil, thrift.NewTTransportException(thrift.NOT_OPEN, err.Error())
	}
	conn, err := net.ListenUDP(addr.Network(), addr)
	if err != nil {
		return nil, thrift.NewTTransportException(thrift.NOT_OPEN, err.Error())
	}
	return &TUDPTransport{addr: conn.LocalAddr(), conn: conn}, nil
}

// Open does nothing as connection is opened on creation
// Required to maintain thrift.TTransport interface
func (p *TUDPTransport) Open() error {
	return nil
}

// Conn retrieves the underlying net.UDPConn
func (p *TUDPTransport) Conn() *net.UDPConn {
	return p.conn
}

// IsOpen returns true if the connection is open
func (p *TUDPTransport) IsOpen() bool {
	return p.conn != nil && atomic.LoadUint32(&p.closed) == 0
}

// Close closes the connection
func (p *TUDPTransport) Close() error {
	if p.conn != nil && atomic.CompareAndSwapUint32(&p.closed, 0, 1) {
		return p.conn.Close()
	}
	return nil
}

// Addr returns the address that the transport is listening on or writing to
func (p *TUDPTransport) Addr() net.Addr {
	return p.addr
}

// Read reads one UDP packet and puts it in the specified buf
func (p *TUDPTransport) Read(buf []byte) (int, error) {
	if !p.IsOpen() {
		return 0, thrift.NewTTransportException(thrift.NOT_OPEN, "Connection not open")
	}
	n, err := p.conn.Read(buf)
	return n, thrift.NewTTransportExceptionFromError(err)
}

// RemainingBytes returns the max number of bytes (same as Thrift's StreamTransport) as we
// do not know how many bytes we have left.
func (p *TUDPTransport) RemainingBytes() uint64 {
	return maxRemainingBytes
}

// Write writes specified buf to the write buffer
func (p *TUDPTransport) Write(buf []byte) (int, error) {
	return 0, thrift.NewTTransportException(thrift.UNKNOWN_TRANSPORT_EXCEPTION, "Write not implemented")
}

// Flush flushes the write buffer as one udp packet
func (p *TUDPTransport) Flush() error {
	return thrift.NewTTransportException(thrift.UNKNOWN_TRANSPORT_EXCEPTION, "Flush not implemented")
}
