// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/hashicorp/go-plugin/internal/grpcmux"
	"github.com/hashicorp/go-plugin/internal/plugin"
	"github.com/hashicorp/go-plugin/runner"

	"github.com/oklog/run"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// streamer interface is used in the broker to send/receive connection
// information.
type streamer interface {
	Send(*plugin.ConnInfo) error
	Recv() (*plugin.ConnInfo, error)
	Close()
}

// sendErr is used to pass errors back during a send.
type sendErr struct {
	i  *plugin.ConnInfo
	ch chan error
}

// gRPCBrokerServer is used by the plugin to start a stream and to send
// connection information to/from the plugin. Implements GRPCBrokerServer and
// streamer interfaces.
type gRPCBrokerServer struct {
	plugin.UnimplementedGRPCBrokerServer

	// send is used to send connection info to the gRPC stream.
	send chan *sendErr

	// recv is used to receive connection info from the gRPC stream.
	recv chan *plugin.ConnInfo

	// quit closes down the stream.
	quit chan struct{}

	// o is used to ensure we close the quit channel only once.
	o sync.Once
}

func newGRPCBrokerServer() *gRPCBrokerServer {
	return &gRPCBrokerServer{
		send: make(chan *sendErr),
		recv: make(chan *plugin.ConnInfo),
		quit: make(chan struct{}),
	}
}

// StartStream implements the GRPCBrokerServer interface and will block until
// the quit channel is closed or the context reports Done. The stream will pass
// connection information to/from the client.
func (s *gRPCBrokerServer) StartStream(stream plugin.GRPCBroker_StartStreamServer) error {
	doneCh := stream.Context().Done()
	defer s.Close()

	// Proccess send stream
	go func() {
		for {
			select {
			case <-doneCh:
				return
			case <-s.quit:
				return
			case se := <-s.send:
				err := stream.Send(se.i)
				se.ch <- err
			}
		}
	}()

	// Process receive stream
	for {
		i, err := stream.Recv()
		if err != nil {
			return err
		}
		select {
		case <-doneCh:
			return nil
		case <-s.quit:
			return nil
		case s.recv <- i:
		}
	}

	return nil
}

// Send is used by the GRPCBroker to pass connection information into the stream
// to the client.
func (s *gRPCBrokerServer) Send(i *plugin.ConnInfo) error {
	ch := make(chan error)
	defer close(ch)

	select {
	case <-s.quit:
		return errors.New("broker closed")
	case s.send <- &sendErr{
		i:  i,
		ch: ch,
	}:
	}

	return <-ch
}

// Recv is used by the GRPCBroker to pass connection information that has been
// sent from the client from the stream to the broker.
func (s *gRPCBrokerServer) Recv() (*plugin.ConnInfo, error) {
	select {
	case <-s.quit:
		return nil, errors.New("broker closed")
	case i := <-s.recv:
		return i, nil
	}
}

// Close closes the quit channel, shutting down the stream.
func (s *gRPCBrokerServer) Close() {
	s.o.Do(func() {
		close(s.quit)
	})
}

// gRPCBrokerClientImpl is used by the client to start a stream and to send
// connection information to/from the client. Implements GRPCBrokerClient and
// streamer interfaces.
type gRPCBrokerClientImpl struct {
	// client is the underlying GRPC client used to make calls to the server.
	client plugin.GRPCBrokerClient

	// send is used to send connection info to the gRPC stream.
	send chan *sendErr

	// recv is used to receive connection info from the gRPC stream.
	recv chan *plugin.ConnInfo

	// quit closes down the stream.
	quit chan struct{}

	// o is used to ensure we close the quit channel only once.
	o sync.Once
}

func newGRPCBrokerClient(conn *grpc.ClientConn) *gRPCBrokerClientImpl {
	return &gRPCBrokerClientImpl{
		client: plugin.NewGRPCBrokerClient(conn),
		send:   make(chan *sendErr),
		recv:   make(chan *plugin.ConnInfo),
		quit:   make(chan struct{}),
	}
}

// StartStream implements the GRPCBrokerClient interface and will block until
// the quit channel is closed or the context reports Done. The stream will pass
// connection information to/from the plugin.
func (s *gRPCBrokerClientImpl) StartStream() error {
	ctx, cancelFunc := context.WithCancel(context.Background())
	defer cancelFunc()
	defer s.Close()

	stream, err := s.client.StartStream(ctx)
	if err != nil {
		return err
	}
	doneCh := stream.Context().Done()

	go func() {
		for {
			select {
			case <-doneCh:
				return
			case <-s.quit:
				return
			case se := <-s.send:
				err := stream.Send(se.i)
				se.ch <- err
			}
		}
	}()

	for {
		i, err := stream.Recv()
		if err != nil {
			return err
		}
		select {
		case <-doneCh:
			return nil
		case <-s.quit:
			return nil
		case s.recv <- i:
		}
	}

	return nil
}

// Send is used by the GRPCBroker to pass connection information into the stream
// to the plugin.
func (s *gRPCBrokerClientImpl) Send(i *plugin.ConnInfo) error {
	ch := make(chan error)
	defer close(ch)

	select {
	case <-s.quit:
		return errors.New("broker closed")
	case s.send <- &sendErr{
		i:  i,
		ch: ch,
	}:
	}

	return <-ch
}

// Recv is used by the GRPCBroker to pass connection information that has been
// sent from the plugin to the broker.
func (s *gRPCBrokerClientImpl) Recv() (*plugin.ConnInfo, error) {
	select {
	case <-s.quit:
		return nil, errors.New("broker closed")
	case i := <-s.recv:
		return i, nil
	}
}

// Close closes the quit channel, shutting down the stream.
func (s *gRPCBrokerClientImpl) Close() {
	s.o.Do(func() {
		close(s.quit)
	})
}

// GRPCBroker is responsible for brokering connections by unique ID.
//
// It is used by plugins to create multiple gRPC connections and data
// streams between the plugin process and the host process.
//
// This allows a plugin to request a channel with a specific ID to connect to
// or accept a connection from, and the broker handles the details of
// holding these channels open while they're being negotiated.
//
// The Plugin interface has access to these for both Server and Client.
// The broker can be used by either (optionally) to reserve and connect to
// new streams. This is useful for complex args and return values,
// or anything else you might need a data stream for.
type GRPCBroker struct {
	nextId   uint32
	streamer streamer
	tls      *tls.Config
	doneCh   chan struct{}
	o        sync.Once

	clientStreams map[uint32]*gRPCBrokerPending
	serverStreams map[uint32]*gRPCBrokerPending

	unixSocketCfg  UnixSocketConfig
	addrTranslator runner.AddrTranslator

	dialMutex sync.Mutex

	muxer grpcmux.GRPCMuxer

	sync.Mutex
}

type gRPCBrokerPending struct {
	ch     chan *plugin.ConnInfo
	doneCh chan struct{}
	once   sync.Once
}

func newGRPCBroker(s streamer, tls *tls.Config, unixSocketCfg UnixSocketConfig, addrTranslator runner.AddrTranslator, muxer grpcmux.GRPCMuxer) *GRPCBroker {
	return &GRPCBroker{
		streamer: s,
		tls:      tls,
		doneCh:   make(chan struct{}),

		clientStreams: make(map[uint32]*gRPCBrokerPending),
		serverStreams: make(map[uint32]*gRPCBrokerPending),
		muxer:         muxer,

		unixSocketCfg:  unixSocketCfg,
		addrTranslator: addrTranslator,
	}
}

// Accept accepts a connection by ID.
//
// This should not be called multiple times with the same ID at one time.
func (b *GRPCBroker) Accept(id uint32) (net.Listener, error) {
	if b.muxer.Enabled() {
		p := b.getServerStream(id)
		go func() {
			err := b.listenForKnocks(id)
			if err != nil {
				log.Printf("[ERR]: error listening for knocks, id: %d, error: %s", id, err)
			}
		}()

		ln, err := b.muxer.Listener(id, p.doneCh)
		if err != nil {
			return nil, err
		}

		ln = &rmListener{
			Listener: ln,
			close: func() error {
				// We could have multiple listeners on the same ID, so use sync.Once
				// for closing doneCh to ensure we don't get a panic.
				p.once.Do(func() {
					close(p.doneCh)
				})

				b.Lock()
				defer b.Unlock()

				// No longer need to listen for knocks once the listener is closed.
				delete(b.serverStreams, id)

				return nil
			},
		}

		return ln, nil
	}

	listener, err := serverListener(b.unixSocketCfg)
	if err != nil {
		return nil, err
	}

	advertiseNet := listener.Addr().Network()
	advertiseAddr := listener.Addr().String()
	if b.addrTranslator != nil {
		advertiseNet, advertiseAddr, err = b.addrTranslator.HostToPlugin(advertiseNet, advertiseAddr)
		if err != nil {
			return nil, err
		}
	}
	err = b.streamer.Send(&plugin.ConnInfo{
		ServiceId: id,
		Network:   advertiseNet,
		Address:   advertiseAddr,
	})
	if err != nil {
		return nil, err
	}

	return listener, nil
}

// AcceptAndServe is used to accept a specific stream ID and immediately
// serve a gRPC server on that stream ID. This is used to easily serve
// complex arguments. Each AcceptAndServe call opens a new listener socket and
// sends the connection info down the stream to the dialer. Since a new
// connection is opened every call, these calls should be used sparingly.
// Multiple gRPC server implementations can be registered to a single
// AcceptAndServe call.
func (b *GRPCBroker) AcceptAndServe(id uint32, newGRPCServer func([]grpc.ServerOption) *grpc.Server) {
	ln, err := b.Accept(id)
	if err != nil {
		log.Printf("[ERR] plugin: plugin acceptAndServe error: %s", err)
		return
	}
	defer ln.Close()

	var opts []grpc.ServerOption
	if b.tls != nil {
		opts = []grpc.ServerOption{grpc.Creds(credentials.NewTLS(b.tls))}
	}

	server := newGRPCServer(opts)

	// Here we use a run group to close this goroutine if the server is shutdown
	// or the broker is shutdown.
	var g run.Group
	{
		// Serve on the listener, if shutting down call GracefulStop.
		g.Add(func() error {
			return server.Serve(ln)
		}, func(err error) {
			server.GracefulStop()
		})
	}
	{
		// block on the closeCh or the doneCh. If we are shutting down close the
		// closeCh.
		closeCh := make(chan struct{})
		g.Add(func() error {
			select {
			case <-b.doneCh:
			case <-closeCh:
			}
			return nil
		}, func(err error) {
			close(closeCh)
		})
	}

	// Block until we are done
	g.Run()
}

// Close closes the stream and all servers.
func (b *GRPCBroker) Close() error {
	b.streamer.Close()
	b.o.Do(func() {
		close(b.doneCh)
	})
	return nil
}

func (b *GRPCBroker) listenForKnocks(id uint32) error {
	p := b.getServerStream(id)
	for {
		select {
		case msg := <-p.ch:
			// Shouldn't be possible.
			if msg.ServiceId != id {
				return fmt.Errorf("knock received with wrong service ID; expected %d but got %d", id, msg.ServiceId)
			}

			// Also shouldn't be possible.
			if msg.Knock == nil || !msg.Knock.Knock || msg.Knock.Ack {
				return fmt.Errorf("knock received for service ID %d with incorrect values; knock=%+v", id, msg.Knock)
			}

			// Successful knock, open the door for the given ID.
			var ackError string
			err := b.muxer.AcceptKnock(id)
			if err != nil {
				ackError = err.Error()
			}

			// Send back an acknowledgement to allow the client to start dialling.
			err = b.streamer.Send(&plugin.ConnInfo{
				ServiceId: id,
				Knock: &plugin.ConnInfo_Knock{
					Knock: true,
					Ack:   true,
					Error: ackError,
				},
			})
			if err != nil {
				return fmt.Errorf("error sending back knock acknowledgement: %w", err)
			}
		case <-p.doneCh:
			return nil
		}
	}
}

func (b *GRPCBroker) knock(id uint32) error {
	// Send a knock.
	err := b.streamer.Send(&plugin.ConnInfo{
		ServiceId: id,
		Knock: &plugin.ConnInfo_Knock{
			Knock: true,
		},
	})
	if err != nil {
		return err
	}

	// Wait for the ack.
	p := b.getClientStream(id)
	select {
	case msg := <-p.ch:
		if msg.ServiceId != id {
			return fmt.Errorf("handshake failed for multiplexing on id %d; got response for %d", id, msg.ServiceId)
		}
		if msg.Knock == nil || !msg.Knock.Knock || !msg.Knock.Ack {
			return fmt.Errorf("handshake failed for multiplexing on id %d; expected knock and ack, but got %+v", id, msg.Knock)
		}
		if msg.Knock.Error != "" {
			return fmt.Errorf("failed to knock for id %d: %s", id, msg.Knock.Error)
		}
	case <-time.After(5 * time.Second):
		return fmt.Errorf("timeout waiting for multiplexing knock handshake on id %d", id)
	}

	return nil
}

func (b *GRPCBroker) muxDial(id uint32) func(string, time.Duration) (net.Conn, error) {
	return func(string, time.Duration) (net.Conn, error) {
		b.dialMutex.Lock()
		defer b.dialMutex.Unlock()

		// Tell the other side the listener ID it should give the next stream to.
		err := b.knock(id)
		if err != nil {
			return nil, fmt.Errorf("failed to knock before dialling client: %w", err)
		}

		conn, err := b.muxer.Dial()
		if err != nil {
			return nil, err
		}

		return conn, nil
	}
}

// Dial opens a connection by ID.
func (b *GRPCBroker) Dial(id uint32) (conn *grpc.ClientConn, err error) { return b.DialWithOptions(id) }

// Dial opens a connection by ID with options.
func (b *GRPCBroker) DialWithOptions(id uint32, opts ...grpc.DialOption) (conn *grpc.ClientConn, err error) {
	if b.muxer.Enabled() {
		return dialGRPCConn(b.tls, b.muxDial(id), opts...)
	}

	var c *plugin.ConnInfo

	// Open the stream
	p := b.getClientStream(id)
	select {
	case c = <-p.ch:
		close(p.doneCh)
	case <-time.After(5 * time.Second):
		return nil, fmt.Errorf("timeout waiting for connection info")
	}

	network, address := c.Network, c.Address
	if b.addrTranslator != nil {
		network, address, err = b.addrTranslator.PluginToHost(network, address)
		if err != nil {
			return nil, err
		}
	}

	var addr net.Addr
	switch network {
	case "tcp":
		addr, err = net.ResolveTCPAddr("tcp", address)
	case "unix":
		addr, err = net.ResolveUnixAddr("unix", address)
	default:
		err = fmt.Errorf("Unknown address type: %s", c.Address)
	}
	if err != nil {
		return nil, err
	}

	return dialGRPCConn(b.tls, netAddrDialer(addr), opts...)
}

// NextId returns a unique ID to use next.
//
// It is possible for very long-running plugin hosts to wrap this value,
// though it would require a very large amount of calls. In practice
// we've never seen it happen.
func (m *GRPCBroker) NextId() uint32 {
	return atomic.AddUint32(&m.nextId, 1)
}

// Run starts the brokering and should be executed in a goroutine, since it
// blocks forever, or until the session closes.
//
// Uses of GRPCBroker never need to call this. It is called internally by
// the plugin host/client.
func (m *GRPCBroker) Run() {
	for {
		msg, err := m.streamer.Recv()
		if err != nil {
			// Once we receive an error, just exit
			break
		}

		// Initialize the waiter
		var p *gRPCBrokerPending
		if msg.Knock != nil && msg.Knock.Knock && !msg.Knock.Ack {
			p = m.getServerStream(msg.ServiceId)
			// The server side doesn't close the channel immediately as it needs
			// to continuously listen for knocks.
		} else {
			p = m.getClientStream(msg.ServiceId)
			go m.timeoutWait(msg.ServiceId, p)
		}
		select {
		case p.ch <- msg:
		default:
		}
	}
}

// getClientStream is a buffer to receive new connection info and knock acks
// by stream ID.
func (m *GRPCBroker) getClientStream(id uint32) *gRPCBrokerPending {
	m.Lock()
	defer m.Unlock()

	p, ok := m.clientStreams[id]
	if ok {
		return p
	}

	m.clientStreams[id] = &gRPCBrokerPending{
		ch:     make(chan *plugin.ConnInfo, 1),
		doneCh: make(chan struct{}),
	}
	return m.clientStreams[id]
}

// getServerStream is a buffer to receive knocks to a multiplexed stream ID
// that its side is listening on. Not used unless multiplexing is enabled.
func (m *GRPCBroker) getServerStream(id uint32) *gRPCBrokerPending {
	m.Lock()
	defer m.Unlock()

	p, ok := m.serverStreams[id]
	if ok {
		return p
	}

	m.serverStreams[id] = &gRPCBrokerPending{
		ch:     make(chan *plugin.ConnInfo, 1),
		doneCh: make(chan struct{}),
	}
	return m.serverStreams[id]
}

func (m *GRPCBroker) timeoutWait(id uint32, p *gRPCBrokerPending) {
	// Wait for the stream to either be picked up and connected, or
	// for a timeout.
	select {
	case <-p.doneCh:
	case <-time.After(5 * time.Second):
	}

	m.Lock()
	defer m.Unlock()

	// Delete the stream so no one else can grab it
	delete(m.clientStreams, id)
}
