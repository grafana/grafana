// Copyright 2020 The Prometheus Authors
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

// Forked from https://github.com/mxinden/memberlist-tls-transport.

// Implements Transport interface so that all gossip communications occur via TLS over TCP.

package cluster

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/hashicorp/go-sockaddr"
	"github.com/hashicorp/memberlist"
	"github.com/prometheus/client_golang/prometheus"
	common "github.com/prometheus/common/config"
	"github.com/prometheus/exporter-toolkit/web"
)

const (
	metricNamespace = "alertmanager"
	metricSubsystem = "tls_transport"
	network         = "tcp"
)

// TLSTransport is a Transport implementation that uses TLS over TCP for both
// packet and stream operations.
type TLSTransport struct {
	ctx          context.Context
	cancel       context.CancelFunc
	logger       log.Logger
	bindAddr     string
	bindPort     int
	done         chan struct{}
	listener     net.Listener
	packetCh     chan *memberlist.Packet
	streamCh     chan net.Conn
	connPool     *connectionPool
	tlsServerCfg *tls.Config
	tlsClientCfg *tls.Config

	packetsSent prometheus.Counter
	packetsRcvd prometheus.Counter
	streamsSent prometheus.Counter
	streamsRcvd prometheus.Counter
	readErrs    prometheus.Counter
	writeErrs   *prometheus.CounterVec
}

// NewTLSTransport returns a TLS transport with the given configuration.
// On successful initialization, a tls listener will be created and listening.
// A valid bindAddr is required. If bindPort == 0, the system will assign
// a free port automatically.
func NewTLSTransport(
	ctx context.Context,
	logger log.Logger,
	reg prometheus.Registerer,
	bindAddr string,
	bindPort int,
	cfg *TLSTransportConfig,
) (*TLSTransport, error) {
	if cfg == nil {
		return nil, errors.New("must specify TLSTransportConfig")
	}

	tlsServerCfg, err := web.ConfigToTLSConfig(cfg.TLSServerConfig)
	if err != nil {
		return nil, fmt.Errorf("invalid TLS server config: %w", err)
	}

	tlsClientCfg, err := common.NewTLSConfig(cfg.TLSClientConfig)
	if err != nil {
		return nil, fmt.Errorf("invalid TLS client config: %w", err)
	}

	ip := net.ParseIP(bindAddr)
	if ip == nil {
		return nil, fmt.Errorf("invalid bind address \"%s\"", bindAddr)
	}

	addr := &net.TCPAddr{IP: ip, Port: bindPort}
	listener, err := tls.Listen(network, addr.String(), tlsServerCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to start TLS listener on %q port %d: %w", bindAddr, bindPort, err)
	}

	connPool, err := newConnectionPool(tlsClientCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize tls transport connection pool: %w", err)
	}

	ctx, cancel := context.WithCancel(ctx)
	t := &TLSTransport{
		ctx:          ctx,
		cancel:       cancel,
		logger:       logger,
		bindAddr:     bindAddr,
		bindPort:     bindPort,
		done:         make(chan struct{}),
		listener:     listener,
		packetCh:     make(chan *memberlist.Packet),
		streamCh:     make(chan net.Conn),
		connPool:     connPool,
		tlsServerCfg: tlsServerCfg,
		tlsClientCfg: tlsClientCfg,
	}

	t.registerMetrics(reg)

	go func() {
		t.listen()
		close(t.done)
	}()
	return t, nil
}

// FinalAdvertiseAddr is given the user's configured values (which
// might be empty) and returns the desired IP and port to advertise to
// the rest of the cluster.
func (t *TLSTransport) FinalAdvertiseAddr(ip string, port int) (net.IP, int, error) {
	var advertiseAddr net.IP
	var advertisePort int
	if ip != "" {
		advertiseAddr = net.ParseIP(ip)
		if advertiseAddr == nil {
			return nil, 0, fmt.Errorf("failed to parse advertise address %q", ip)
		}

		if ip4 := advertiseAddr.To4(); ip4 != nil {
			advertiseAddr = ip4
		}
		advertisePort = port
	} else {
		if t.bindAddr == "0.0.0.0" {
			// Otherwise, if we're not bound to a specific IP, let's
			// use a suitable private IP address.
			var err error
			ip, err = sockaddr.GetPrivateIP()
			if err != nil {
				return nil, 0, fmt.Errorf("failed to get interface addresses: %w", err)
			}
			if ip == "" {
				return nil, 0, fmt.Errorf("no private IP address found, and explicit IP not provided")
			}

			advertiseAddr = net.ParseIP(ip)
			if advertiseAddr == nil {
				return nil, 0, fmt.Errorf("failed to parse advertise address: %q", ip)
			}
		} else {
			advertiseAddr = t.listener.Addr().(*net.TCPAddr).IP
		}
		advertisePort = t.GetAutoBindPort()
	}
	return advertiseAddr, advertisePort, nil
}

// PacketCh returns a channel that can be read to receive incoming
// packets from other peers.
func (t *TLSTransport) PacketCh() <-chan *memberlist.Packet {
	return t.packetCh
}

// StreamCh returns a channel that can be read to handle incoming stream
// connections from other peers.
func (t *TLSTransport) StreamCh() <-chan net.Conn {
	return t.streamCh
}

// Shutdown is called when memberlist is shutting down; this gives the
// TLS Transport a chance to clean up the listener and other goroutines.
func (t *TLSTransport) Shutdown() error {
	level.Debug(t.logger).Log("msg", "shutting down tls transport")
	t.cancel()
	err := t.listener.Close()
	t.connPool.shutdown()
	<-t.done
	return err
}

// WriteTo is a packet-oriented interface that borrows a connection
// from the pool, and writes to it. It also returns a timestamp of when
// the packet was written.
func (t *TLSTransport) WriteTo(b []byte, addr string) (time.Time, error) {
	conn, err := t.connPool.borrowConnection(addr, DefaultTCPTimeout)
	if err != nil {
		t.writeErrs.WithLabelValues("packet").Inc()
		return time.Now(), fmt.Errorf("failed to dial: %w", err)
	}
	fromAddr := t.listener.Addr().String()
	err = conn.writePacket(fromAddr, b)
	if err != nil {
		t.writeErrs.WithLabelValues("packet").Inc()
		return time.Now(), fmt.Errorf("failed to write packet: %w", err)
	}
	t.packetsSent.Add(float64(len(b)))
	return time.Now(), nil
}

// DialTimeout is used to create a connection that allows memberlist
// to perform two-way communications with a peer.
func (t *TLSTransport) DialTimeout(addr string, timeout time.Duration) (net.Conn, error) {
	conn, err := dialTLSConn(addr, timeout, t.tlsClientCfg)
	if err != nil {
		t.writeErrs.WithLabelValues("stream").Inc()
		return nil, fmt.Errorf("failed to dial: %w", err)
	}
	err = conn.writeStream()
	netConn := conn.getRawConn()
	if err != nil {
		t.writeErrs.WithLabelValues("stream").Inc()
		return netConn, fmt.Errorf("failed to create stream connection: %w", err)
	}
	t.streamsSent.Inc()
	return netConn, nil
}

// GetAutoBindPort returns the bind port that was automatically given by the system
// if a bindPort of 0 was specified during instantiation.
func (t *TLSTransport) GetAutoBindPort() int {
	return t.listener.Addr().(*net.TCPAddr).Port
}

// listen starts up multiple handlers accepting concurrent connections.
func (t *TLSTransport) listen() {
	for {
		select {
		case <-t.ctx.Done():

			return
		default:
			conn, err := t.listener.Accept()
			if err != nil {
				// The error "use of closed network connection" is returned when the listener is closed.
				// It is not exported in a more reasonable way. See https://github.com/golang/go/issues/4373.
				if strings.Contains(err.Error(), "use of closed network connection") {
					return
				}
				t.readErrs.Inc()
				level.Debug(t.logger).Log("msg", "error accepting connection", "err", err)

			} else {
				go t.handle(conn)
			}
		}
	}
}

func (t *TLSTransport) handle(conn net.Conn) {
	for {
		packet, err := rcvTLSConn(conn).read()
		if err != nil {
			level.Debug(t.logger).Log("msg", "error reading from connection", "err", err)
			t.readErrs.Inc()
			return
		}
		select {
		case <-t.ctx.Done():
			return
		default:
			if packet != nil {
				n := len(packet.Buf)
				t.packetCh <- packet
				t.packetsRcvd.Add(float64(n))
			} else {
				t.streamCh <- conn
				t.streamsRcvd.Inc()
				return
			}
		}
	}
}

func (t *TLSTransport) registerMetrics(reg prometheus.Registerer) {
	t.packetsSent = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: metricNamespace,
			Subsystem: metricSubsystem,
			Name:      "packet_bytes_sent_total",
			Help:      "The number of packet bytes sent to outgoing connections (excluding internal metadata).",
		},
	)
	t.packetsRcvd = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: metricNamespace,
			Subsystem: metricSubsystem,
			Name:      "packet_bytes_received_total",
			Help:      "The number of packet bytes received from incoming connections (excluding internal metadata).",
		},
	)
	t.streamsSent = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: metricNamespace,
			Subsystem: metricSubsystem,
			Name:      "stream_connections_sent_total",
			Help:      "The number of stream connections sent.",
		},
	)

	t.streamsRcvd = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: metricNamespace,
			Subsystem: metricSubsystem,
			Name:      "stream_connections_received_total",
			Help:      "The number of stream connections received.",
		},
	)
	t.readErrs = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: metricNamespace,
			Subsystem: metricSubsystem,
			Name:      "read_errors_total",
			Help:      "The number of errors encountered while reading from incoming connections.",
		},
	)
	t.writeErrs = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: metricNamespace,
			Subsystem: metricSubsystem,
			Name:      "write_errors_total",
			Help:      "The number of errors encountered while writing to outgoing connections.",
		},
		[]string{"connection_type"},
	)

	if reg != nil {
		reg.MustRegister(t.packetsSent)
		reg.MustRegister(t.packetsRcvd)
		reg.MustRegister(t.streamsSent)
		reg.MustRegister(t.streamsRcvd)
		reg.MustRegister(t.readErrs)
		reg.MustRegister(t.writeErrs)
	}
}
