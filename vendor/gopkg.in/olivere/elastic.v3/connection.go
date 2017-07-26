// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"sync"
	"time"
)

// conn represents a single connection to a node in a cluster.
type conn struct {
	sync.RWMutex
	nodeID    string // node ID
	url       string
	failures  int
	dead      bool
	deadSince *time.Time
}

// newConn creates a new connection to the given URL.
func newConn(nodeID, url string) *conn {
	c := &conn{
		nodeID: nodeID,
		url:    url,
	}
	return c
}

// String returns a representation of the connection status.
func (c *conn) String() string {
	c.RLock()
	defer c.RUnlock()
	return fmt.Sprintf("%s [dead=%v,failures=%d,deadSince=%v]", c.url, c.dead, c.failures, c.deadSince)
}

// NodeID returns the ID of the node of this connection.
func (c *conn) NodeID() string {
	c.RLock()
	defer c.RUnlock()
	return c.nodeID
}

// URL returns the URL of this connection.
func (c *conn) URL() string {
	c.RLock()
	defer c.RUnlock()
	return c.url
}

// IsDead returns true if this connection is marked as dead, i.e. a previous
// request to the URL has been unsuccessful.
func (c *conn) IsDead() bool {
	c.RLock()
	defer c.RUnlock()
	return c.dead
}

// MarkAsDead marks this connection as dead, increments the failures
// counter and stores the current time in dead since.
func (c *conn) MarkAsDead() {
	c.Lock()
	c.dead = true
	if c.deadSince == nil {
		utcNow := time.Now().UTC()
		c.deadSince = &utcNow
	}
	c.failures++
	c.Unlock()
}

// MarkAsAlive marks this connection as eligible to be returned from the
// pool of connections by the selector.
func (c *conn) MarkAsAlive() {
	c.Lock()
	c.dead = false
	c.Unlock()
}

// MarkAsHealthy marks this connection as healthy, i.e. a request has been
// successfully performed with it.
func (c *conn) MarkAsHealthy() {
	c.Lock()
	c.dead = false
	c.deadSince = nil
	c.failures = 0
	c.Unlock()
}
