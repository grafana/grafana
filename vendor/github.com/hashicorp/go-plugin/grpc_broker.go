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

	"github.com/oklog/run"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// streamer interface is used in the broker to send/receive connection
// information.
type streamer interface {
	Send(*ConnInfo) error
	Recv() (*ConnInfo, error)
	Close()
}

// sendErr is used to pass errors back during a send.
type sendErr struct {
	i  *ConnInfo
	ch chan error
}

// gRPCBrokerServer is used by the plugin to start a stream and to send
// connection information to/from the plugin. Implements GRPCBrokerServer and
// streamer interfaces.
type gRPCBrokerServer struct {
	// send is used to send connection info to the gRPC stream.
	send chan *sendErr

	// recv is used to receive connection info from the gRPC stream.
	recv chan *ConnInfo

	// quit closes down the stream.
	quit chan struct{}

	// o is used to ensure we close the quit channel only once.
	o sync.Once
}

func newGRPCBrokerServer() *gRPCBrokerServer {
	return &gRPCBrokerServer{
		send: make(chan *sendErr),
		recv: make(chan *ConnInfo),
		quit: make(chan struct{}),
	}
}

// StartStream implements the GRPCBrokerServer interface and will block until
// the quit channel is closed or the context reports Done. The stream will pass
// connection information to/from the client.
func (s *gRPCBrokerServer) StartStream(stream GRPCBroker_StartStreamServer) error {
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
func (s *gRPCBrokerServer) Send(i *ConnInfo) error {
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
func (s *gRPCBrokerServer) Recv() (*ConnInfo, error) {
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
	client GRPCBrokerClient

	// send is used to send connection info to the gRPC stream.
	send chan *sendErr

	// recv is used to receive connection info from the gRPC stream.
	recv chan *ConnInfo

	// quit closes down the stream.
	quit chan struct{}

	// o is used to ensure we close the quit channel only once.
	o sync.Once
}

func newGRPCBrokerClient(conn *grpc.ClientConn) *gRPCBrokerClientImpl {
	return &gRPCBrokerClientImpl{
		client: NewGRPCBrokerClient(conn),
		send:   make(chan *sendErr),
		recv:   make(chan *ConnInfo),
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
func (s *gRPCBrokerClientImpl) Send(i *ConnInfo) error {
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
func (s *gRPCBrokerClientImpl) Recv() (*ConnInfo, error) {
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
	streams  map[uint32]*gRPCBrokerPending
	tls      *tls.Config
	doneCh   chan struct{}
	o        sync.Once

	sync.Mutex
}

type gRPCBrokerPending struct {
	ch     chan *ConnInfo
	doneCh chan struct{}
}

func newGRPCBroker(s streamer, tls *tls.Config) *GRPCBroker {
	return &GRPCBroker{
		streamer: s,
		streams:  make(map[uint32]*gRPCBrokerPending),
		tls:      tls,
		doneCh:   make(chan struct{}),
	}
}

// Accept accepts a connection by ID.
//
// This should not be called multiple times with the same ID at one time.
func (b *GRPCBroker) Accept(id uint32) (net.Listener, error) {
	listener, err := serverListener()
	if err != nil {
		return nil, err
	}

	err = b.streamer.Send(&ConnInfo{
		ServiceId: id,
		Network:   listener.Addr().Network(),
		Address:   listener.Addr().String(),
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
func (b *GRPCBroker) AcceptAndServe(id uint32, s func([]grpc.ServerOption) *grpc.Server) {
	listener, err := b.Accept(id)
	if err != nil {
		log.Printf("[ERR] plugin: plugin acceptAndServe error: %s", err)
		return
	}
	defer listener.Close()

	var opts []grpc.ServerOption
	if b.tls != nil {
		opts = []grpc.ServerOption{grpc.Creds(credentials.NewTLS(b.tls))}
	}

	server := s(opts)

	// Here we use a run group to close this goroutine if the server is shutdown
	// or the broker is shutdown.
	var g run.Group
	{
		// Serve on the listener, if shutting down call GracefulStop.
		g.Add(func() error {
			return server.Serve(listener)
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

// Dial opens a connection by ID.
func (b *GRPCBroker) Dial(id uint32) (conn *grpc.ClientConn, err error) {
	var c *ConnInfo

	// Open the stream
	p := b.getStream(id)
	select {
	case c = <-p.ch:
		close(p.doneCh)
	case <-time.After(5 * time.Second):
		return nil, fmt.Errorf("timeout waiting for connection info")
	}

	var addr net.Addr
	switch c.Network {
	case "tcp":
		addr, err = net.ResolveTCPAddr("tcp", c.Address)
	case "unix":
		addr, err = net.ResolveUnixAddr("unix", c.Address)
	default:
		err = fmt.Errorf("Unknown address type: %s", c.Address)
	}
	if err != nil {
		return nil, err
	}

	return dialGRPCConn(b.tls, netAddrDialer(addr))
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
		stream, err := m.streamer.Recv()
		if err != nil {
			// Once we receive an error, just exit
			break
		}

		// Initialize the waiter
		p := m.getStream(stream.ServiceId)
		select {
		case p.ch <- stream:
		default:
		}

		go m.timeoutWait(stream.ServiceId, p)
	}
}

func (m *GRPCBroker) getStream(id uint32) *gRPCBrokerPending {
	m.Lock()
	defer m.Unlock()

	p, ok := m.streams[id]
	if ok {
		return p
	}

	m.streams[id] = &gRPCBrokerPending{
		ch:     make(chan *ConnInfo, 1),
		doneCh: make(chan struct{}),
	}
	return m.streams[id]
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
	delete(m.streams, id)
}
