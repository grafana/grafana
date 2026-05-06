// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/counting_listener.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"net"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

// CountingListener returns a Listener that increments a Prometheus gauge when
// a connection is accepted, and decrements the gauge when the connection is closed.
func CountingListener(l net.Listener, g prometheus.Gauge) net.Listener {
	return &countingListener{Listener: l, gauge: g}
}

type countingListener struct {
	net.Listener
	gauge prometheus.Gauge
}

func (c *countingListener) Accept() (net.Conn, error) {
	conn, err := c.Listener.Accept()
	if err != nil {
		return nil, err
	}
	c.gauge.Inc()
	return &countingListenerConn{Conn: conn, gauge: c.gauge}, nil
}

type countingListenerConn struct {
	net.Conn
	gauge prometheus.Gauge
	once  sync.Once
}

func (l *countingListenerConn) Close() error {
	err := l.Conn.Close()

	// Only ever decrement the gauge once in case of badly behaving callers.
	l.once.Do(func() { l.gauge.Dec() })

	return err
}
