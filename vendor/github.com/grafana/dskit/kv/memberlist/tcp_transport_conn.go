package memberlist

import (
	"net"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/atomic"
)

const (
	// flushThreshold is the number of bytes after which we flush the local counters
	// to the Prometheus counters. This reduces the frequency of expensive Prometheus
	// counters updates.
	flushThreshold = 64 * 1024 // 64KB
)

// meteredConn wraps a net.Conn to track the number of bytes sent and received.
// It periodically flushes the byte counts to Prometheus counters when a threshold
// is reached, and always flushes on Close() to ensure accurate tracking for
// short-lived connections.
type meteredConn struct {
	net.Conn

	sentBytesCounter     prometheus.Counter
	receivedBytesCounter prometheus.Counter

	sentBytesLocal     atomic.Int64
	receivedBytesLocal atomic.Int64
}

// newMeteredConn creates a new metered connection wrapper.
func newMeteredConn(conn net.Conn, sentBytes, receivedBytes prometheus.Counter) *meteredConn {
	return &meteredConn{
		Conn:                 conn,
		sentBytesCounter:     sentBytes,
		receivedBytesCounter: receivedBytes,
	}
}

// Read implement net.Conn.
func (c *meteredConn) Read(b []byte) (n int, err error) {
	n, err = c.Conn.Read(b)
	if n > 0 {
		c.addReceivedBytes(int64(n))
	}
	return n, err
}

// Write implement net.Conn.
func (c *meteredConn) Write(b []byte) (n int, err error) {
	n, err = c.Conn.Write(b)
	if n > 0 {
		c.addSentBytes(int64(n))
	}
	return n, err
}

// Close implement net.Conn.
func (c *meteredConn) Close() error {
	c.flush()
	return c.Conn.Close()
}

// SetDeadline implements net.Conn.
func (c *meteredConn) SetDeadline(t time.Time) error {
	return c.Conn.SetDeadline(t)
}

// SetReadDeadline implements net.Conn.
func (c *meteredConn) SetReadDeadline(t time.Time) error {
	return c.Conn.SetReadDeadline(t)
}

// SetWriteDeadline implements net.Conn.
func (c *meteredConn) SetWriteDeadline(t time.Time) error {
	return c.Conn.SetWriteDeadline(t)
}

// addSentBytes adds bytes to the local sent counter and flushes to Prometheus if threshold is reached.
func (c *meteredConn) addSentBytes(n int64) {
	newTotal := c.sentBytesLocal.Add(n)
	if newTotal >= flushThreshold {
		c.flush()
	}
}

// addReceivedBytes adds bytes to the local received counter and flushes to Prometheus if threshold is reached.
func (c *meteredConn) addReceivedBytes(n int64) {
	newTotal := c.receivedBytesLocal.Add(n)
	if newTotal >= flushThreshold {
		c.flush()
	}
}

// flush flushes any remaining local byte counters to the Prometheus counters.
func (c *meteredConn) flush() {
	if sentBytes := c.sentBytesLocal.Swap(0); sentBytes > 0 {
		c.sentBytesCounter.Add(float64(sentBytes))
	}
	if receivedBytes := c.receivedBytesLocal.Swap(0); receivedBytes > 0 {
		c.receivedBytesCounter.Add(float64(receivedBytes))
	}
}
