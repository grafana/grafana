// Copyright (c) 2020 The Jaeger Authors.
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

package utils

import (
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/uber/jaeger-client-go/log"
)

// reconnectingUDPConn is an implementation of udpConn that resolves hostPort every resolveTimeout, if the resolved address is
// different than the current conn then the new address is dialed and the conn is swapped.
type reconnectingUDPConn struct {
	hostPort    string
	resolveFunc resolveFunc
	dialFunc    dialFunc
	logger      log.Logger
	bufferBytes int64

	connMtx   sync.RWMutex
	conn      *net.UDPConn
	destAddr  *net.UDPAddr
	closeChan chan struct{}
}

type resolveFunc func(network string, hostPort string) (*net.UDPAddr, error)
type dialFunc func(network string, laddr, raddr *net.UDPAddr) (*net.UDPConn, error)

// newReconnectingUDPConn returns a new udpConn that resolves hostPort every resolveTimeout, if the resolved address is
// different than the current conn then the new address is dialed and the conn is swapped.
func newReconnectingUDPConn(hostPort string, resolveTimeout time.Duration, resolveFunc resolveFunc, dialFunc dialFunc, logger log.Logger) (*reconnectingUDPConn, error) {
	conn := &reconnectingUDPConn{
		hostPort:    hostPort,
		resolveFunc: resolveFunc,
		dialFunc:    dialFunc,
		logger:      logger,
		closeChan:   make(chan struct{}),
	}

	if err := conn.attemptResolveAndDial(); err != nil {
		logger.Error(fmt.Sprintf("failed resolving destination address on connection startup, with err: %q. retrying in %s", err.Error(), resolveTimeout))
	}

	go conn.reconnectLoop(resolveTimeout)

	return conn, nil
}

func (c *reconnectingUDPConn) reconnectLoop(resolveTimeout time.Duration) {
	ticker := time.NewTicker(resolveTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-c.closeChan:
			return
		case <-ticker.C:
			if err := c.attemptResolveAndDial(); err != nil {
				c.logger.Error(err.Error())
			}
		}
	}
}

func (c *reconnectingUDPConn) attemptResolveAndDial() error {
	newAddr, err := c.resolveFunc("udp", c.hostPort)
	if err != nil {
		return fmt.Errorf("failed to resolve new addr for host %q, with err: %w", c.hostPort, err)
	}

	c.connMtx.RLock()
	curAddr := c.destAddr
	c.connMtx.RUnlock()

	// dont attempt dial if an addr was successfully dialed previously and, resolved addr is the same as current conn
	if curAddr != nil && newAddr.String() == curAddr.String() {
		return nil
	}

	if err := c.attemptDialNewAddr(newAddr); err != nil {
		return fmt.Errorf("failed to dial newly resolved addr '%s', with err: %w", newAddr, err)
	}

	return nil
}

func (c *reconnectingUDPConn) attemptDialNewAddr(newAddr *net.UDPAddr) error {
	connUDP, err := c.dialFunc(newAddr.Network(), nil, newAddr)
	if err != nil {
		return err
	}

	if bufferBytes := int(atomic.LoadInt64(&c.bufferBytes)); bufferBytes != 0 {
		if err = connUDP.SetWriteBuffer(bufferBytes); err != nil {
			return err
		}
	}

	c.connMtx.Lock()
	c.destAddr = newAddr
	// store prev to close later
	prevConn := c.conn
	c.conn = connUDP
	c.connMtx.Unlock()

	if prevConn != nil {
		return prevConn.Close()
	}

	return nil
}

// Write calls net.udpConn.Write, if it fails an attempt is made to connect to a new addr, if that succeeds the write is retried before returning
func (c *reconnectingUDPConn) Write(b []byte) (int, error) {
	var bytesWritten int
	var err error

	c.connMtx.RLock()
	if c.conn == nil {
		// if connection is not initialized indicate this with err in order to hook into retry logic
		err = fmt.Errorf("UDP connection not yet initialized, an address has not been resolved")
	} else {
		bytesWritten, err = c.conn.Write(b)
	}
	c.connMtx.RUnlock()

	if err == nil {
		return bytesWritten, nil
	}

	// attempt to resolve and dial new address in case that's the problem, if resolve and dial succeeds, try write again
	if reconnErr := c.attemptResolveAndDial(); reconnErr == nil {
		c.connMtx.RLock()
		defer c.connMtx.RUnlock()
		return c.conn.Write(b)
	}

	// return original error if reconn fails
	return bytesWritten, err
}

// Close stops the reconnectLoop, then closes the connection via net.udpConn 's implementation
func (c *reconnectingUDPConn) Close() error {
	close(c.closeChan)

	// acquire rw lock before closing conn to ensure calls to Write drain
	c.connMtx.Lock()
	defer c.connMtx.Unlock()

	if c.conn != nil {
		return c.conn.Close()
	}

	return nil
}

// SetWriteBuffer defers to the net.udpConn SetWriteBuffer implementation wrapped with a RLock. if no conn is currently held
// and SetWriteBuffer is called store bufferBytes to be set for new conns
func (c *reconnectingUDPConn) SetWriteBuffer(bytes int) error {
	var err error

	c.connMtx.RLock()
	if c.conn != nil {
		err = c.conn.SetWriteBuffer(bytes)
	}
	c.connMtx.RUnlock()

	if err == nil {
		atomic.StoreInt64(&c.bufferBytes, int64(bytes))
	}

	return err
}
