package redisc

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gomodule/redigo/redis"
)

var _ redis.ConnWithTimeout = (*Conn)(nil)

// Conn is a redis cluster connection. When returned by Get
// or Dial, it is not yet bound to any node in the cluster.
// Only when a call to Do, Send, Receive or Bind is made is a connection
// to a specific node established:
//
//     - if Do or Send is called first, the command's first parameter
//       is assumed to be the key, and its slot is used to find the node
//     - if Receive is called first, or if Do or Send is called first
//       but with no parameter for the command (or no command), a
//       random node is selected in the cluster
//     - if Bind is called first, the node corresponding to the slot of
//       the specified key(s) is selected
//
// Because Get and Dial return a redis.Conn interface,
// a type assertion can be used to call Bind or ReadOnly on this
// concrete Conn type:
//
//     redisConn := cluster.Get()
//     if conn, ok := redisConn.(*redisc.Conn); ok {
//       if err := conn.Bind("my-key"); err != nil {
//         // handle error
//       }
//     }
//
// Or call the package-level BindConn or ReadOnlyConn helper functions.
//
type Conn struct {
	cluster   *Cluster
	forceDial bool // immutable

	// redigo allows concurrent reader and writer (conn.Receive and
	// conn.Send/conn.Flush), a mutex is needed to protect concurrent
	// accesses.
	mu        sync.Mutex
	readOnly  bool
	boundAddr string
	err       error
	rc        redis.Conn
}

// RedirError is a cluster redirection error. It indicates that
// the redis node returned either a MOVED or an ASK error, as
// specified by the Type field.
type RedirError struct {
	// Type indicates if the redirection is a MOVED or an ASK.
	Type string
	// NewSlot is the slot number of the redirection.
	NewSlot int
	// Addr is the node address to redirect to.
	Addr string

	raw string
}

// Error returns the error message of a RedirError. This is the
// message as received from redis.
func (e *RedirError) Error() string {
	return e.raw
}

func isRedisErr(err error, typ string) bool {
	re, ok := err.(redis.Error)
	if !ok {
		return false
	}
	parts := strings.Fields(re.Error())
	return len(parts) > 0 && parts[0] == typ
}

// IsTryAgain returns true if the error is a redis cluster
// error of type TRYAGAIN, meaning that the command is valid,
// but the cluster is in an unstable state and it can't complete
// the request at the moment.
func IsTryAgain(err error) bool {
	return isRedisErr(err, "TRYAGAIN")
}

// IsCrossSlot returns true if the error is a redis cluster
// error of type CROSSSLOT, meaning that a command was sent
// with keys from different slots.
func IsCrossSlot(err error) bool {
	return isRedisErr(err, "CROSSSLOT")
}

// ParseRedir parses err into a RedirError. If err is
// not a MOVED or ASK error or if it is nil, it returns nil.
func ParseRedir(err error) *RedirError {
	re, ok := err.(redis.Error)
	if !ok {
		return nil
	}
	parts := strings.Fields(re.Error())
	if len(parts) != 3 || (parts[0] != "MOVED" && parts[0] != "ASK") {
		return nil
	}
	slot, err := strconv.Atoi(parts[1])
	if err != nil {
		return nil
	}
	return &RedirError{
		Type:    parts[0],
		NewSlot: slot,
		Addr:    parts[2],
		raw:     re.Error(),
	}
}

// binds the connection to a specific node, the one holding the slot
// or a random node if slot is -1, iff the connection is not broken
// and is not already bound. It returns the redis conn, true if it
// successfully bound to this slot, or any error.
func (c *Conn) bind(slot int) (rc redis.Conn, ok bool, err error) {
	c.mu.Lock()
	rc, err = c.rc, c.err
	if err == nil {
		if rc == nil {
			conn, addr, err2 := c.cluster.getConn(slot, c.forceDial, c.readOnly)
			if err2 != nil {
				err = err2
			} else {
				c.rc, rc = conn, conn
				c.boundAddr = addr
				ok = true
			}
		}
	}
	c.mu.Unlock()
	return rc, ok, err
}

func cmdSlot(cmd string, args []interface{}) int {
	slot := -1
	if len(args) > 0 {
		key := fmt.Sprintf("%s", args[0])
		slot = Slot(key)
	}
	return slot
}

// BindConn is a convenience function that checks if c implements
// a Bind method with the right signature such as the one for
// a *Conn, and calls that method. If c doesn't implement that
// method, it returns an error.
func BindConn(c redis.Conn, keys ...string) error {
	if cc, ok := c.(interface {
		Bind(...string) error
	}); ok {
		return cc.Bind(keys...)
	}
	return errors.New("redisc: no Bind method")
}

// Bind binds the connection to the cluster node corresponding to
// the slot of the provided keys. If the keys don't belong to the
// same slot, an error is returned and the connection is not bound.
// If the connection is already bound, an error is returned.
// If no key is provided, it binds to a random node.
func (c *Conn) Bind(keys ...string) error {
	slot := -1
	for _, k := range keys {
		ks := Slot(k)
		if slot != -1 && ks != slot {
			return errors.New("redisc: keys do not belong to the same slot")
		}
		slot = ks
	}

	_, ok, err := c.bind(slot)
	if err != nil {
		return err
	}
	if !ok {
		// was already bound
		return errors.New("redisc: connection already bound to a node")
	}
	return nil
}

// ReadOnlyConn is a convenience function that checks if c implements
// a ReadOnly method with the right signature such as the one for
// a *Conn, and calls that method. If c doesn't implement that
// method, it returns an error.
func ReadOnlyConn(c redis.Conn) error {
	if cc, ok := c.(interface {
		ReadOnly() error
	}); ok {
		return cc.ReadOnly()
	}
	return errors.New("redisc: no ReadOnly method")
}

// ReadOnly marks the connection as read-only, meaning that when it is
// bound to a cluster node, it will attempt to connect to a replica instead
// of the master and will automatically emit a READONLY command so that
// the replica agrees to serve read commands. Be aware that reading
// from a replica may return stale data. Sending write commands on a
// read-only connection will fail with a MOVED error.
// See http://redis.io/commands/readonly for more details.
//
// If the connection is already bound to a node, either via a call to
// Do, Send, Receive or Bind, ReadOnly returns an error.
func (c *Conn) ReadOnly() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.err != nil {
		return c.err
	}
	if c.rc != nil {
		// was already bound
		return errors.New("redisc: connection already bound to a node")
	}
	c.readOnly = true
	return nil
}

// Do sends a command to the server and returns the received reply.
// If the connection is not yet bound to a cluster node, it will be
// after this call, based on the rules documented in the Conn type.
func (c *Conn) Do(cmd string, args ...interface{}) (interface{}, error) {
	return c.DoWithTimeout(-1, cmd, args...)
}

// DoWithTimeout sends a command to the server and returns the received reply.
// If the connection is not yet bound to a cluster node, it will be
// after this call, based on the rules documented in the Conn type.
//
// The timeout overrides the read timeout set when dialing the
// connection (in the DialOptions of the Cluster).
func (c *Conn) DoWithTimeout(timeout time.Duration, cmd string, args ...interface{}) (v interface{}, err error) {
	// The blank command is a special redigo/redis command that flushes the
	// output buffer and receives all pending replies. This is used, for example,
	// when returning a Redis conneciton back to the pool. If we recieve the
	// blank command, don't bind to a random node if this connection is not bound
	// yet.
	if cmd == "" && len(args) == 0 {
		c.mu.Lock()
		rc := c.rc
		c.mu.Unlock()
		if rc == nil {
			return nil, nil
		}
	}

	rc, _, err := c.bind(cmdSlot(cmd, args))
	if err != nil {
		return nil, err
	}
	if timeout < 0 {
		v, err = rc.Do(cmd, args...)
	} else if rcwt, ok := rc.(redis.ConnWithTimeout); ok {
		v, err = rcwt.DoWithTimeout(timeout, cmd, args...)
	} else {
		return nil, errors.New("redisc: connection does not support ConnWithTimeout")
	}
	// handle redirections, if any
	if re := ParseRedir(err); re != nil {
		if re.Type == "MOVED" {
			c.cluster.needsRefresh(re)
		}
	}
	return v, err
}

// Send writes the command to the client's output buffer. If the
// connection is not yet bound to a cluster node, it will be after
// this call, based on the rules documented in the Conn type.
func (c *Conn) Send(cmd string, args ...interface{}) error {
	rc, _, err := c.bind(cmdSlot(cmd, args))
	if err != nil {
		return err
	}
	return rc.Send(cmd, args...)
}

// Receive receives a single reply from the server. If the connection
// is not yet bound to a cluster node, it will be after this call,
// based on the rules documented in the Conn type.
func (c *Conn) Receive() (interface{}, error) {
	return c.ReceiveWithTimeout(-1)
}

// ReceiveWithTimeout receives a single reply from the Redis server.
// If the connection is not yet bound to a cluster node, it will be
// after this call, based on the rules documented in the Conn type.
//
// The timeout overrides the read timeout set when dialing the
// connection (in the DialOptions of the Cluster).
func (c *Conn) ReceiveWithTimeout(timeout time.Duration) (v interface{}, err error) {
	rc, _, err := c.bind(-1)
	if err != nil {
		return nil, err
	}
	if timeout < 0 {
		v, err = rc.Receive()
	} else if rcwt, ok := rc.(redis.ConnWithTimeout); ok {
		v, err = rcwt.ReceiveWithTimeout(timeout)
	} else {
		return nil, errors.New("redisc: connection does not support ConnWithTimeout")
	}
	// handle redirections, if any
	if re := ParseRedir(err); re != nil {
		if re.Type == "MOVED" {
			c.cluster.needsRefresh(re)
		}
	}
	return v, err
}

// Flush flushes the output buffer to the server.
func (c *Conn) Flush() error {
	c.mu.Lock()
	err := c.err
	if err == nil && c.rc != nil {
		err = c.rc.Flush()
	}
	c.mu.Unlock()
	return err
}

// Err returns a non-nil value if the connection is broken. Applications
// should close broken connections.
func (c *Conn) Err() error {
	c.mu.Lock()
	err := c.err
	if err == nil && c.rc != nil {
		err = c.rc.Err()
	}
	c.mu.Unlock()
	return err
}

// Close closes the connection.
func (c *Conn) Close() error {
	c.mu.Lock()
	err := c.err
	if err == nil {
		c.err = errors.New("redisc: closed")
		err = c.closeLocked()
	}
	c.mu.Unlock()
	return err
}

func (c *Conn) closeLocked() (err error) {
	if c.rc != nil {
		// this may be a pooled connection, so make sure the readOnly flag is reset
		if c.readOnly {
			c.rc.Do("READWRITE")
		}
		err = c.rc.Close()
	}
	return err
}
