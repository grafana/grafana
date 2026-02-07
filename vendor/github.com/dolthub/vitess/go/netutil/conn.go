/*
Copyright 2019 The Vitess Authors.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package netutil

import (
	"net"
	"sync"
	"time"
)

var _ net.Conn = (*ConnWithTimeouts)(nil)

// A ConnWithTimeouts is a wrapper to net.Conn that allows to set a read and write timeouts.
type ConnWithTimeouts struct {
	net.Conn
	readTimeout  time.Duration
	writeTimeout time.Duration
	mu           *sync.Mutex
}

// NewConnWithTimeouts wraps a net.Conn with read and write timeouts.
// It sets a new read or write deadline on every Read or Write call,
// based on the given Deadline.
//
// If a client calls Set{,Read,Write}Deadline on this connection,
// the managed timeouts are disabled and the new deadlines are
// forwarded to the underlying connection. It is assumed the client
// is fully responsible for deadline handling from that point forward.
func NewConnWithTimeouts(conn net.Conn, readTimeout time.Duration, writeTimeout time.Duration) ConnWithTimeouts {
	return ConnWithTimeouts{Conn: conn, readTimeout: readTimeout, writeTimeout: writeTimeout, mu: &sync.Mutex{}}
}

// Implementation of the Conn interface.

// Read sets a read deadilne and delegates to conn.Read.
func (c ConnWithTimeouts) Read(b []byte) (int, error) {
	c.mu.Lock()
	if c.readTimeout == 0 {
		c.mu.Unlock()
		return c.Conn.Read(b)
	}
	if err := c.Conn.SetReadDeadline(time.Now().Add(c.readTimeout)); err != nil {
		c.mu.Unlock()
		return 0, err
	}
	c.mu.Unlock()
	return c.Conn.Read(b)
}

// Write sets a write deadline and delegates to conn.Write
func (c ConnWithTimeouts) Write(b []byte) (int, error) {
	c.mu.Lock()
	if c.writeTimeout == 0 {
		c.mu.Unlock()
		return c.Conn.Write(b)
	}
	if err := c.Conn.SetWriteDeadline(time.Now().Add(c.writeTimeout)); err != nil {
		c.mu.Unlock()
		return 0, err
	}
	c.mu.Unlock()
	return c.Conn.Write(b)
}

// SetDeadline implements the Conn SetDeadline method.
func (c ConnWithTimeouts) SetDeadline(t time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.readTimeout = 0
	c.writeTimeout = 0
	return c.Conn.SetDeadline(t)
}

// SetReadDeadline implements the Conn SetReadDeadline method.
func (c ConnWithTimeouts) SetReadDeadline(t time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.readTimeout = 0
	return c.Conn.SetReadDeadline(t)
}

// SetWriteDeadline implements the Conn SetWriteDeadline method.
func (c ConnWithTimeouts) SetWriteDeadline(t time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.writeTimeout = 0
	return c.Conn.SetWriteDeadline(t)
}
