package memberlist

import (
	"bytes"
	"crypto/md5"
	"crypto/tls"
	"flag"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	sockaddr "github.com/hashicorp/go-sockaddr"
	"github.com/hashicorp/memberlist"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	dstls "github.com/grafana/dskit/crypto/tls"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/netutil"
)

type messageType uint8

const (
	_ messageType = iota // don't use 0
	packet
	stream
)

const zeroZeroZeroZero = "0.0.0.0"
const colonColon = "::"

// TCPTransportConfig is a configuration structure for creating new TCPTransport.
type TCPTransportConfig struct {
	// BindAddrs is a list of IP addresses to bind to.
	BindAddrs flagext.StringSlice `yaml:"bind_addr"`

	// BindPort is the port to listen on, for each address above.
	BindPort int `yaml:"bind_port"`

	// Timeout used when making connections to other nodes to send packet.
	// Zero = no timeout
	PacketDialTimeout time.Duration `yaml:"packet_dial_timeout" category:"advanced"`

	// Timeout for writing packet data. Zero = no timeout.
	PacketWriteTimeout time.Duration `yaml:"packet_write_timeout" category:"advanced"`

	// Maximum number of concurrent writes to other nodes.
	MaxConcurrentWrites int `yaml:"max_concurrent_writes" category:"advanced"`

	// Timeout for acquiring one of the concurrent write slots.
	AcquireWriterTimeout time.Duration `yaml:"acquire_writer_timeout" category:"advanced"`

	// Transport logs lots of messages at debug level, so it deserves an extra flag for turning it on
	TransportDebug bool `yaml:"-" category:"advanced"`

	// Where to put custom metrics. nil = don't register.
	MetricsNamespace string `yaml:"-"`

	TLSEnabled bool               `yaml:"tls_enabled" category:"advanced"`
	TLS        dstls.ClientConfig `yaml:",inline"`
}

func (cfg *TCPTransportConfig) RegisterFlags(f *flag.FlagSet) {
	cfg.RegisterFlagsWithPrefix(f, "")
}

// RegisterFlagsWithPrefix registers flags with prefix.
func (cfg *TCPTransportConfig) RegisterFlagsWithPrefix(f *flag.FlagSet, prefix string) {
	// "Defaults to hostname" -- memberlist sets it to hostname by default.
	f.Var(&cfg.BindAddrs, prefix+"memberlist.bind-addr", "IP address to listen on for gossip messages. Multiple addresses may be specified. Defaults to 0.0.0.0")
	f.IntVar(&cfg.BindPort, prefix+"memberlist.bind-port", 7946, "Port to listen on for gossip messages.")
	f.DurationVar(&cfg.PacketDialTimeout, prefix+"memberlist.packet-dial-timeout", 2*time.Second, "Timeout used when connecting to other nodes to send packet.")
	f.DurationVar(&cfg.PacketWriteTimeout, prefix+"memberlist.packet-write-timeout", 5*time.Second, "Timeout for writing 'packet' data.")
	f.IntVar(&cfg.MaxConcurrentWrites, prefix+"memberlist.max-concurrent-writes", 3, "Maximum number of concurrent writes to other nodes.")
	f.DurationVar(&cfg.AcquireWriterTimeout, prefix+"memberlist.acquire-writer-timeout", 250*time.Millisecond, "Timeout for acquiring one of the concurrent write slots. After this time, the message will be dropped.")
	f.BoolVar(&cfg.TransportDebug, prefix+"memberlist.transport-debug", false, "Log debug transport messages. Note: global log.level must be at debug level as well.")

	f.BoolVar(&cfg.TLSEnabled, prefix+"memberlist.tls-enabled", false, "Enable TLS on the memberlist transport layer.")
	cfg.TLS.RegisterFlagsWithPrefix(prefix+"memberlist", f)
}

type writeRequest struct {
	b    []byte
	addr string
}

// TCPTransport is a memberlist.Transport implementation that uses TCP for both packet and stream
// operations ("packet" and "stream" are terms used by memberlist).
// It uses a new TCP connections for each operation. There is no connection reuse.
type TCPTransport struct {
	cfg          TCPTransportConfig
	logger       log.Logger
	packetCh     chan *memberlist.Packet
	connCh       chan net.Conn
	wg           sync.WaitGroup
	tcpListeners []net.Listener
	tlsConfig    *tls.Config

	shutdownMu sync.RWMutex
	shutdown   bool
	writeCh    chan writeRequest // this channel is protected by shutdownMu

	writeWG sync.WaitGroup

	advertiseMu   sync.RWMutex
	advertiseAddr string

	// metrics
	incomingStreams      prometheus.Counter
	outgoingStreams      prometheus.Counter
	outgoingStreamErrors prometheus.Counter

	receivedPackets       prometheus.Counter
	receivedPacketsBytes  prometheus.Counter
	receivedPacketsErrors prometheus.Counter
	sentPackets           prometheus.Counter
	sentPacketsBytes      prometheus.Counter
	sentPacketsErrors     prometheus.Counter
	droppedPackets        prometheus.Counter
	unknownConnections    prometheus.Counter
}

// NewTCPTransport returns a new tcp-based transport with the given configuration. On
// success all the network listeners will be created and listening.
func NewTCPTransport(config TCPTransportConfig, logger log.Logger, registerer prometheus.Registerer) (*TCPTransport, error) {
	if len(config.BindAddrs) == 0 {
		config.BindAddrs = []string{zeroZeroZeroZero}
	}

	// Build out the new transport.
	var ok bool
	concurrentWrites := config.MaxConcurrentWrites
	if concurrentWrites <= 0 {
		concurrentWrites = 1
	}
	t := TCPTransport{
		cfg:      config,
		logger:   log.With(logger, "component", "memberlist TCPTransport"),
		packetCh: make(chan *memberlist.Packet),
		connCh:   make(chan net.Conn),
		writeCh:  make(chan writeRequest),
	}

	for i := 0; i < concurrentWrites; i++ {
		t.writeWG.Add(1)
		go t.writeWorker()
	}

	var err error
	if config.TLSEnabled {
		t.tlsConfig, err = config.TLS.GetTLSConfig()
		if err != nil {
			return nil, errors.Wrap(err, "unable to create TLS config")
		}
	}

	t.registerMetrics(registerer)

	// Clean up listeners if there's an error.
	defer func() {
		if !ok {
			_ = t.Shutdown()
		}
	}()

	// Build all the TCP and UDP listeners.
	port := config.BindPort
	for _, addr := range config.BindAddrs {
		ip := net.ParseIP(addr)
		if ip == nil {
			return nil, fmt.Errorf("could not parse bind addr %q as IP address", addr)
		}

		tcpAddr := &net.TCPAddr{IP: ip, Port: port}

		var tcpLn net.Listener
		if config.TLSEnabled {
			tcpLn, err = tls.Listen("tcp", tcpAddr.String(), t.tlsConfig)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to start TLS TCP listener on %q port %d", addr, port)
			}
		} else {
			tcpLn, err = net.ListenTCP("tcp", tcpAddr)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to start TCP listener on %q port %d", addr, port)
			}
		}

		t.tcpListeners = append(t.tcpListeners, tcpLn)

		// If the config port given was zero, use the first TCP listener
		// to pick an available port and then apply that to everything
		// else.
		if port == 0 {
			port = tcpLn.Addr().(*net.TCPAddr).Port
		}
	}

	// Fire them up now that we've been able to create them all.
	for i := 0; i < len(config.BindAddrs); i++ {
		t.wg.Add(1)
		go t.tcpListen(t.tcpListeners[i])
	}

	ok = true
	return &t, nil
}

// tcpListen is a long running goroutine that accepts incoming TCP connections
// and spawns new go routine to handle each connection. This transport uses TCP connections
// for both packet sending and streams.
// (copied from Memberlist net_transport.go)
func (t *TCPTransport) tcpListen(tcpLn net.Listener) {
	defer t.wg.Done()

	// baseDelay is the initial delay after an AcceptTCP() error before attempting again
	const baseDelay = 5 * time.Millisecond

	// maxDelay is the maximum delay after an AcceptTCP() error before attempting again.
	// In the case that tcpListen() is error-looping, it will delay the shutdown check.
	// Therefore, changes to maxDelay may have an effect on the latency of shutdown.
	const maxDelay = 1 * time.Second

	var loopDelay time.Duration
	for {
		conn, err := tcpLn.Accept()
		if err != nil {
			t.shutdownMu.RLock()
			isShuttingDown := t.shutdown
			t.shutdownMu.RUnlock()
			if isShuttingDown {
				break
			}

			if loopDelay == 0 {
				loopDelay = baseDelay
			} else {
				loopDelay *= 2
			}

			if loopDelay > maxDelay {
				loopDelay = maxDelay
			}

			level.Error(t.logger).Log("msg", "Error accepting TCP connection", "err", err)
			time.Sleep(loopDelay)
			continue
		}
		// No error, reset loop delay
		loopDelay = 0

		go t.handleConnection(conn)
	}
}

var noopLogger = log.NewNopLogger()

func (t *TCPTransport) debugLog() log.Logger {
	if t.cfg.TransportDebug {
		return level.Debug(t.logger)
	}
	return noopLogger
}

func (t *TCPTransport) handleConnection(conn net.Conn) {
	t.debugLog().Log("msg", "New connection", "addr", conn.RemoteAddr())

	closeConn := true
	defer func() {
		if closeConn {
			_ = conn.Close()
		}
	}()

	// let's read first byte, and determine what to do about this connection
	msgType := []byte{0}
	_, err := io.ReadFull(conn, msgType)
	if err != nil {
		level.Warn(t.logger).Log("msg", "failed to read message type", "err", err, "remote", conn.RemoteAddr())
		return
	}

	if messageType(msgType[0]) == stream {
		t.incomingStreams.Inc()

		// hand over this connection to memberlist
		closeConn = false
		t.connCh <- conn
	} else if messageType(msgType[0]) == packet {
		// it's a memberlist "packet", which contains an address and data.
		t.receivedPackets.Inc()

		// before reading packet, read the address
		addrLengthBuf := []byte{0}
		_, err := io.ReadFull(conn, addrLengthBuf)
		if err != nil {
			t.receivedPacketsErrors.Inc()
			level.Warn(t.logger).Log("msg", "error while reading node address length from packet", "err", err, "remote", conn.RemoteAddr())
			return
		}

		addrBuf := make([]byte, addrLengthBuf[0])
		_, err = io.ReadFull(conn, addrBuf)
		if err != nil {
			t.receivedPacketsErrors.Inc()
			level.Warn(t.logger).Log("msg", "error while reading node address from packet", "err", err, "remote", conn.RemoteAddr())
			return
		}

		// read the rest to buffer -- this is the "packet" itself
		buf, err := io.ReadAll(conn)
		if err != nil {
			t.receivedPacketsErrors.Inc()
			level.Warn(t.logger).Log("msg", "error while reading packet data", "err", err, "remote", conn.RemoteAddr())
			return
		}

		if len(buf) < md5.Size {
			t.receivedPacketsErrors.Inc()
			level.Warn(t.logger).Log("msg", "not enough data received", "data_length", len(buf), "remote", conn.RemoteAddr())
			return
		}

		receivedDigest := buf[len(buf)-md5.Size:]
		buf = buf[:len(buf)-md5.Size]

		expectedDigest := md5.Sum(buf)

		if !bytes.Equal(receivedDigest, expectedDigest[:]) {
			t.receivedPacketsErrors.Inc()
			level.Warn(t.logger).Log("msg", "packet digest mismatch", "expected", fmt.Sprintf("%x", expectedDigest), "received", fmt.Sprintf("%x", receivedDigest), "data_length", len(buf), "remote", conn.RemoteAddr())
		}

		t.debugLog().Log("msg", "Received packet", "addr", addr(addrBuf), "size", len(buf), "hash", fmt.Sprintf("%x", receivedDigest))

		t.receivedPacketsBytes.Add(float64(len(buf)))

		t.packetCh <- &memberlist.Packet{
			Buf:       buf,
			From:      addr(addrBuf),
			Timestamp: time.Now(),
		}
	} else {
		t.unknownConnections.Inc()
		level.Error(t.logger).Log("msg", "unknown message type", "msgType", msgType, "remote", conn.RemoteAddr())
	}
}

type addr string

func (a addr) Network() string {
	return "tcp"
}

func (a addr) String() string {
	return string(a)
}

func (t *TCPTransport) getConnection(addr string, timeout time.Duration) (net.Conn, error) {
	if t.cfg.TLSEnabled {
		return tls.DialWithDialer(&net.Dialer{Timeout: timeout}, "tcp", addr, t.tlsConfig)
	}
	return net.DialTimeout("tcp", addr, timeout)
}

// GetAutoBindPort returns the bind port that was automatically given by the
// kernel, if a bind port of 0 was given.
func (t *TCPTransport) GetAutoBindPort() int {
	// We made sure there's at least one TCP listener, and that one's
	// port was applied to all the others for the dynamic bind case.
	return t.tcpListeners[0].Addr().(*net.TCPAddr).Port
}

// FinalAdvertiseAddr is given the user's configured values (which
// might be empty) and returns the desired IP and port to advertise to
// the rest of the cluster.
// (Copied from memberlist' net_transport.go)
func (t *TCPTransport) FinalAdvertiseAddr(ip string, port int) (net.IP, int, error) {
	var advertiseAddr net.IP
	var advertisePort int
	if ip != "" {
		// If they've supplied an address, use that.
		advertiseAddr = net.ParseIP(ip)
		if advertiseAddr == nil {
			return nil, 0, fmt.Errorf("failed to parse advertise address %q", ip)
		}

		advertisePort = port
	} else {

		switch t.cfg.BindAddrs[0] {
		case zeroZeroZeroZero:
			// Otherwise, if we're not bound to a specific IP, let's
			// use a suitable private IP address.
			var err error
			ip, err = sockaddr.GetPrivateIP()
			if err != nil {
				return nil, 0, fmt.Errorf("failed to get interface addresses: %v", err)
			}
			if ip == "" {
				return nil, 0, fmt.Errorf("no private IP address found, and explicit IP not provided")
			}

			advertiseAddr = net.ParseIP(ip)
			if advertiseAddr == nil {
				return nil, 0, fmt.Errorf("failed to parse advertise address %q", ip)
			}
		case colonColon:
			inet6Ip, err := netutil.GetFirstAddressOf(nil, t.logger, true)
			if err != nil {
				return nil, 0, fmt.Errorf("failed to get private inet6 address: %w", err)
			}

			advertiseAddr = net.ParseIP(inet6Ip)
			if advertiseAddr == nil {
				return nil, 0, fmt.Errorf("failed to parse inet6 advertise address %q", ip)
			}
		default:
			// Use the IP that we're bound to, based on the first
			// TCP listener, which we already ensure is there.
			advertiseAddr = t.tcpListeners[0].Addr().(*net.TCPAddr).IP
		}

		// Use the port we are bound to.
		advertisePort = t.GetAutoBindPort()
	}

	level.Debug(t.logger).Log("msg", "FinalAdvertiseAddr", "advertiseAddr", advertiseAddr.String(), "advertisePort", advertisePort)

	t.setAdvertisedAddr(advertiseAddr, advertisePort)
	return advertiseAddr, advertisePort, nil
}

func (t *TCPTransport) setAdvertisedAddr(advertiseAddr net.IP, advertisePort int) {
	t.advertiseMu.Lock()
	defer t.advertiseMu.Unlock()
	addr := net.TCPAddr{IP: advertiseAddr, Port: advertisePort}
	t.advertiseAddr = addr.String()
}

func (t *TCPTransport) getAdvertisedAddr() string {
	t.advertiseMu.RLock()
	defer t.advertiseMu.RUnlock()
	return t.advertiseAddr
}

// WriteTo is a packet-oriented interface that fires off the given
// payload to the given address.
func (t *TCPTransport) WriteTo(b []byte, addr string) (time.Time, error) {
	t.shutdownMu.RLock()
	defer t.shutdownMu.RUnlock() // Unlock at the end to protect the chan
	if t.shutdown {
		return time.Time{}, errors.New("transport is shutting down")
	}

	// Send the packet to the write workers
	// If this blocks for too long (as configured), abort and log an error.
	select {
	case <-time.After(t.cfg.AcquireWriterTimeout):
		// Dropped packets are not an issue, the memberlist protocol will retry later.
		level.Debug(t.logger).Log("msg", "WriteTo failed to acquire a writer. Dropping message", "timeout", t.cfg.AcquireWriterTimeout, "addr", addr)
		t.droppedPackets.Inc()
		// WriteTo is used to send "UDP" packets. Since we use TCP, we can detect more errors,
		// but memberlist library doesn't seem to cope with that very well. That is why we return nil instead.
		return time.Now(), nil
	case t.writeCh <- writeRequest{b: b, addr: addr}:
		// OK
	}

	return time.Now(), nil
}

func (t *TCPTransport) writeWorker() {
	defer t.writeWG.Done()
	for req := range t.writeCh {
		b, addr := req.b, req.addr
		t.sentPackets.Inc()
		t.sentPacketsBytes.Add(float64(len(b)))
		err := t.writeTo(b, addr)
		if err != nil {
			t.sentPacketsErrors.Inc()

			logLevel := level.Warn(t.logger)
			if strings.Contains(err.Error(), "connection refused") {
				// The connection refused is a common error that could happen during normal operations when a node
				// shutdown (or crash). It shouldn't be considered a warning condition on the sender side.
				logLevel = t.debugLog()
			}
			logLevel.Log("msg", "WriteTo failed", "addr", addr, "err", err)
		}
	}
}

func (t *TCPTransport) writeTo(b []byte, addr string) error {
	// Open connection, write packet header and data, data hash, close. Simple.
	c, err := t.getConnection(addr, t.cfg.PacketDialTimeout)
	if err != nil {
		return err
	}

	closed := false
	defer func() {
		if !closed {
			// If we still need to close, then there was another error. Ignore this one.
			_ = c.Close()
		}
	}()

	// Compute the digest *before* setting the deadline on the connection (so that the time
	// it takes to compute the digest is not taken in account).
	// We use md5 as quick and relatively short hash, not in cryptographic context.
	// It's also used to detect if the whole packet has been received on the receiver side.
	digest := md5.Sum(b)

	// Prepare the header *before* setting the deadline on the connection.
	headerBuf := bytes.Buffer{}
	headerBuf.WriteByte(byte(packet))

	// We need to send our address to the other side, otherwise other side can only see IP and port from TCP header.
	// But that doesn't match our node address (new TCP connection has new random port), which confuses memberlist.
	// So we send our advertised address, so that memberlist on the receiving side can match it with correct node.
	// This seems to be important for node probes (pings) done by memberlist.
	ourAddr := t.getAdvertisedAddr()
	if len(ourAddr) > 255 {
		return fmt.Errorf("local address too long")
	}

	headerBuf.WriteByte(byte(len(ourAddr)))
	headerBuf.WriteString(ourAddr)

	if t.cfg.PacketWriteTimeout > 0 {
		deadline := time.Now().Add(t.cfg.PacketWriteTimeout)
		err := c.SetDeadline(deadline)
		if err != nil {
			return fmt.Errorf("setting deadline: %v", err)
		}
	}

	_, err = c.Write(headerBuf.Bytes())
	if err != nil {
		return fmt.Errorf("sending local address: %v", err)
	}

	n, err := c.Write(b)
	if err != nil {
		return fmt.Errorf("sending data: %v", err)
	}
	if n != len(b) {
		return fmt.Errorf("sending data: short write")
	}

	// Append digest.
	n, err = c.Write(digest[:])
	if err != nil {
		return fmt.Errorf("digest: %v", err)
	}
	if n != len(digest) {
		return fmt.Errorf("digest: short write")
	}

	closed = true
	err = c.Close()
	if err != nil {
		return fmt.Errorf("close: %v", err)
	}

	t.debugLog().Log("msg", "WriteTo: packet sent", "addr", addr, "size", len(b), "hash", fmt.Sprintf("%x", digest))
	return nil
}

// PacketCh returns a channel that can be read to receive incoming
// packets from other peers.
func (t *TCPTransport) PacketCh() <-chan *memberlist.Packet {
	return t.packetCh
}

// DialTimeout is used to create a connection that allows memberlist to perform
// two-way communication with a peer.
func (t *TCPTransport) DialTimeout(addr string, timeout time.Duration) (net.Conn, error) {
	t.outgoingStreams.Inc()
	c, err := t.getConnection(addr, timeout)

	if err != nil {
		t.outgoingStreamErrors.Inc()
		return nil, err
	}

	_, err = c.Write([]byte{byte(stream)})
	if err != nil {
		t.outgoingStreamErrors.Inc()
		_ = c.Close()
		return nil, err
	}

	return c, nil
}

// StreamCh returns a channel that can be read to handle incoming stream
// connections from other peers.
func (t *TCPTransport) StreamCh() <-chan net.Conn {
	return t.connCh
}

// Shutdown is called when memberlist is shutting down; this gives the
// transport a chance to clean up any listeners.
// This will avoid log spam about errors when we shut down.
func (t *TCPTransport) Shutdown() error {
	t.shutdownMu.Lock()
	// This will avoid log spam about errors when we shut down.
	if t.shutdown {
		t.shutdownMu.Unlock()
		return nil // already shut down
	}

	// Set the shutdown flag and close the write channel.
	t.shutdown = true
	close(t.writeCh)
	t.shutdownMu.Unlock()

	// Rip through all the connections and shut them down.
	for _, conn := range t.tcpListeners {
		_ = conn.Close()
	}

	// Wait until all write workers have finished.
	t.writeWG.Wait()

	// Block until all the listener threads have died.
	t.wg.Wait()

	return nil
}

func (t *TCPTransport) registerMetrics(registerer prometheus.Registerer) {
	const subsystem = "memberlist_tcp_transport"

	t.incomingStreams = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "incoming_streams_total",
		Help:      "Number of incoming memberlist streams",
	})

	t.outgoingStreams = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "outgoing_streams_total",
		Help:      "Number of outgoing streams",
	})

	t.outgoingStreamErrors = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "outgoing_stream_errors_total",
		Help:      "Number of errors when opening memberlist stream to another node",
	})

	t.receivedPackets = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "packets_received_total",
		Help:      "Number of received memberlist packets",
	})

	t.receivedPacketsBytes = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "packets_received_bytes_total",
		Help:      "Total bytes received as packets",
	})

	t.receivedPacketsErrors = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "packets_received_errors_total",
		Help:      "Number of errors when receiving memberlist packets",
	})

	t.droppedPackets = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "packets_dropped_total",
		Help:      "Number of dropped memberlist packets. These packets were not sent due to timeout waiting for a writer.",
	})

	t.sentPackets = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "packets_sent_total",
		Help:      "Number of memberlist packets sent",
	})

	t.sentPacketsBytes = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "packets_sent_bytes_total",
		Help:      "Total bytes sent as packets",
	})

	t.sentPacketsErrors = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "packets_sent_errors_total",
		Help:      "Number of errors when sending memberlist packets",
	})

	t.unknownConnections = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Namespace: t.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "unknown_connections_total",
		Help:      "Number of unknown TCP connections (not a packet or stream)",
	})
}
