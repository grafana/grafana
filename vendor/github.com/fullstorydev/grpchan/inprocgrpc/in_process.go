// Package inprocgrpc provides an in-process gRPC channel implementation.
// The in-process channel makes RPCs that are effectively in-process function
// calls. The function calls run in a separate goroutine from the caller so as
// to fully behave like a normal RPC call, including context deadlines and
// cancellations. This can be useful for same-process hand-off to RPC endpoints
// and for testing. It has less overhead than using a loopback socket connection
// as it elides marshaling to bytes and back.
package inprocgrpc

import (
	"context"
	"fmt"
	"io"
	"reflect"
	"runtime"
	"strings"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/internal"
)

// frame is the unit of communication with gRPC streams. Frames are used to send
// headers, messages, trailers, and errors. (In a normal gRPC client, there is
// no error frame as the error is instead communicated with trailers. But having
// it be a separate frame type for in-process makes the implementation simpler.)
//
// Client streams only send data frames. Client streams cannot include trailers
// or an error, and request headers are communicated separately (via context
// values that are propagated from client context). In a normal gRPC client,
// errors can be communicated with special frames, but for in-process we rely on
// contexts and propagating cancellations thereof for that.
//
// Server streams must send zero or one header frame. If they send one frame, it
// must be the first frame. Servers then send zero or more data frames. They may
// then send zero or one trailer frame and zero or one error frame. (Ordering of
// frame types is strictly required.)
type frame struct {
	// If non-nil, this is a data frame. A data frame has a message.
	// NB(jh): The client should *always* copy the message. That way the server
	// and client aren't sharing the same message across goroutines. With real
	// gRPC, a server is free to mutate the request, and clients are free to
	// re-use request messages after sending. So a defensive copy is required to
	// preserve the same behavior with in-process channel.
	//
	// Data frames are optional for streaming RPCs that allow zero messages to
	// be exchanged. For RPCs that require exactly one message to be exchanged,
	// it may still be omitted if the RPC failed (which means the final frame
	// must be an error frame).
	data interface{}

	// If non-nil, this is a headers frame. A headers frame is optional. If the
	// server is sending no headers, it may be omitted.
	headers metadata.MD

	// If non-nil, this is a trailers frame. A trailers frame is optional. If
	// the server is sending no trailers, it may be omitted.
	trailers metadata.MD

	// If non-nil, this is an error frame. An error frame is optional and is
	// only sent to communicate a non-"OK" response code to the client. The
	// error frame, if present, must be the last frame in the stream.
	err error
}

type frameKind int

const (
	kindHeaders frameKind = iota
	kindData
	kindTrailers
	kindError
	kindUnknown
)

func (m frame) kind() frameKind {
	switch {
	case m.headers != nil:
		return kindHeaders
	case m.data != nil:
		return kindData
	case m.trailers != nil:
		return kindTrailers
	case m.err != nil:
		return kindError
	default:
		return kindUnknown
	}
}

func (m frame) String() string {
	switch m.kind() {
	case kindData:
		return fmt.Sprintf("data:%v", m.data)
	case kindHeaders:
		return fmt.Sprintf("headers:%v", m.headers)
	case kindTrailers:
		return fmt.Sprintf("trailers:%v", m.trailers)
	case kindError:
		return fmt.Sprintf("error:%v", m.err)
	default:
		return "?unknown?"
	}
}

// Channel is a gRPC channel where RPCs amount to an in-process method call.
// This is in contrast to a normal gRPC channel, where request messages
// marshaled to another process over a TCP socket and responses unmarshaled from
// the same socket.
//
// So the in-process channel functions as both a client channel AND a server. It
// handles method calls from a gRPC client stub and then delivers them directly
// to a registered server implementation.
//
// The server-side of an RPC is executed in a separate goroutine, so things like
// deadlines and context cancellation work, even for unary RPCs.
type Channel struct {
	handlers          grpchan.HandlerMap
	unaryInterceptor  grpc.UnaryServerInterceptor
	streamInterceptor grpc.StreamServerInterceptor
	cloner            Cloner
}

var _ grpc.ClientConnInterface = (*Channel)(nil)
var _ grpc.ServiceRegistrar = (*Channel)(nil)

// RegisterService registers the given service and implementation. Like a normal
// gRPC server, an in-process channel only allows a single implementation for a
// particular service. Services are identified by their fully-qualified name
// (e.g. "<package>.<service>").
func (c *Channel) RegisterService(desc *grpc.ServiceDesc, svr interface{}) {
	if c.handlers == nil {
		c.handlers = grpchan.HandlerMap{}
	}
	c.handlers.RegisterService(desc, svr)
}

// WithServerUnaryInterceptor configures the in-process channel to use the given
// server interceptor for unary RPCs when dispatching.
func (c *Channel) WithServerUnaryInterceptor(interceptor grpc.UnaryServerInterceptor) *Channel {
	c.unaryInterceptor = interceptor
	return c
}

// WithServerStreamInterceptor configures the in-process channel to use the
// given server interceptor for streaming RPCs when dispatching.
func (c *Channel) WithServerStreamInterceptor(interceptor grpc.StreamServerInterceptor) *Channel {
	c.streamInterceptor = interceptor
	return c
}

// WithCloner configures the in-process channel to use the given cloner to copy
// data from client to server and vice versa. Messages must be copied to avoid
// concurrent use of message instances.
//
// If no cloner is configured, the default cloner can only properly support
// proto.Message instances. If the messages do not implement proto.Message (or
// if you use gogo/protobuf, whose values implement the golang/proto interface
// but will cause a runtime panic), you must provide a custom cloner.
func (c *Channel) WithCloner(cloner Cloner) *Channel {
	c.cloner = cloner
	return c
}

var inprocessPeer = peer.Peer{
	Addr:     inprocessAddr{},
	AuthInfo: inprocessAddr{},
}

type inprocessAddr struct{}

func (inprocessAddr) Network() string {
	return "inproc"
}

func (inprocessAddr) String() string {
	return "0"
}

func (inprocessAddr) AuthType() string {
	return "inproc"
}

// Invoke satisfies the grpchan.Channel interface and supports sending unary
// RPCs via the in-process channel.
func (c *Channel) Invoke(ctx context.Context, method string, req, resp interface{}, opts ...grpc.CallOption) error {
	copts := internal.GetCallOptions(opts)
	copts.SetPeer(&inprocessPeer)

	if isNil(req) {
		return status.Errorf(codes.Internal, "request message is nil")
	}

	if method[0] != '/' {
		method = "/" + method
	}
	ctx, err := internal.ApplyPerRPCCreds(ctx, copts, fmt.Sprintf("inproc:0%s", method), true)
	if err != nil {
		return err
	}

	strs := strings.SplitN(method[1:], "/", 2)
	serviceName := strs[0]
	methodName := strs[1]
	sd, handler := c.handlers.QueryService(serviceName)
	if sd == nil {
		// service name not found
		return status.Errorf(codes.Unimplemented, "service %s not implemented", serviceName)
	}
	md := internal.FindUnaryMethod(methodName, sd.Methods)
	if md == nil {
		// method name not found
		return status.Errorf(codes.Unimplemented, "method %s/%s not implemented", serviceName, methodName)
	}

	cloner := c.cloner
	if cloner == nil {
		cloner = ProtoCloner{}
	}

	codec := func(out interface{}) error {
		return cloner.Copy(out, req)
	}
	ctx, cancel := context.WithCancel(ctx)
	sts := internal.UnaryServerTransportStream{Name: method}

	defer cancel()
	ch := make(chan frame, 1)
	go func() {
		defer func() {
			sts.Finish()
			close(ch)
		}()
		ctx := grpc.NewContextWithServerTransportStream(makeServerContext(ctx), &sts)
		v, err := md.Handler(handler, ctx, codec, c.unaryInterceptor)
		if h := sts.GetHeaders(); len(h) > 0 {
			_ = writeMessage(ctx, nil, ch, frame{headers: h})
		}
		if err == nil {
			if isNil(v) {
				err = status.Errorf(codes.Internal, "handler returned neither error nor response message")
			} else {
				_ = writeMessage(ctx, nil, ch, frame{data: v})
			}
		}
		if t := sts.GetTrailers(); len(t) > 0 {
			_ = writeMessage(ctx, nil, ch, frame{trailers: t})
		}
		if err != nil {
			_ = writeMessage(ctx, nil, ch, frame{err: err})
		}
	}()

	gotResponse := false
	for {
		select {
		case r, ok := <-ch:
			if !ok {
				// no more messages
				if !gotResponse {
					return io.EOF
				}
				return nil
			}
			switch {
			case r.err != nil:
				return r.err
			case r.data != nil:
				if gotResponse {
					return status.Error(codes.Internal, "server sent unexpected response message")
				}
				gotResponse = true
				if err := cloner.Copy(resp, r.data); err != nil {
					return err
				}
			case r.headers != nil:
				copts.SetHeaders(r.headers)
			case r.trailers != nil:
				copts.SetTrailers(r.trailers)
			default:
				// TODO: panic?
				return status.Error(codes.Internal, "server sent empty frame")
			}
		case <-ctx.Done():
			return internal.TranslateContextError(ctx.Err())
		}
	}
}

// NewStream satisfies the grpchan.Channel interface and supports sending
// streaming RPCs via the in-process channel.
func (c *Channel) NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	copts := internal.GetCallOptions(opts)
	copts.SetPeer(&inprocessPeer)

	if method[0] != '/' {
		method = "/" + method
	}
	ctx, err := internal.ApplyPerRPCCreds(ctx, copts, fmt.Sprintf("inproc:0%s", method), true)
	if err != nil {
		return nil, err
	}

	strs := strings.SplitN(method[1:], "/", 2)
	// The given StreamDesc is a client-created object, which means the Handler
	// field is not populated. So we have to look up from the channel config the
	// corresponding StreamDesc that includes a handler.
	serviceName := strs[0]
	methodName := strs[1]
	sd, handler := c.handlers.QueryService(serviceName)
	if sd == nil {
		// service name not found
		return nil, status.Errorf(codes.Unimplemented, "service %s not implemented", serviceName)
	}
	md := internal.FindStreamingMethod(methodName, sd.Streams)
	if md == nil {
		// method name not found
		return nil, status.Errorf(codes.Unimplemented, "method %s/%s not implemented", serviceName, methodName)
	}

	ctx, cancel := context.WithCancel(ctx)
	// backpressure comes from tiny buffer, in lieu of HTTP/2 flow control
	requests := make(chan frame, 1)
	responses := make(chan frame, 1)

	// the server context which is cancelled when the server goroutine below exits
	svrCtx, svrCancel := context.WithCancel(makeServerContext(ctx))

	// a child context which is cancelled when the RPC completes, but before
	// the server handler has sent its final messages (trailers and errors)
	// (this is needed to prevent deadlock between server trying to send final
	// messages while client is trying to concurrently write a request)
	svrDoneCtx, svrDoneCancel := context.WithCancel(svrCtx)

	cloner := c.cloner
	if cloner == nil {
		cloner = ProtoCloner{}
	}

	go func() {
		defer svrCancel()

		serverStream := &inProcessServerStream{
			cloner:    cloner,
			requests:  requests,
			responses: responses,
			onDone:    svrDoneCancel,
		}
		sts := &internal.ServerTransportStream{Name: method, Stream: serverStream}
		serverStream.ctx = grpc.NewContextWithServerTransportStream(svrCtx, sts)
		var err error
		defer func() {
			serverStream.finish(err)
		}()

		if c.streamInterceptor != nil {
			info := grpc.StreamServerInfo{
				FullMethod:     method,
				IsClientStream: md.ClientStreams,
				IsServerStream: md.ServerStreams,
			}
			err = c.streamInterceptor(handler, serverStream, &info, md.Handler)
		} else {
			err = md.Handler(handler, serverStream)
		}
	}()
	cs := &inProcessClientStream{
		ctx:            ctx,
		cloner:         cloner,
		svrCtx:         svrDoneCtx,
		requests:       requests,
		responses:      responses,
		responseStream: desc.ServerStreams,
		copts:          copts,
	}
	runtime.SetFinalizer(cs, func(stream *inProcessClientStream) {
		cancel()
	})
	return cs, nil
}

var clientContextKey = "holds a client context"

func makeServerContext(ctx context.Context) context.Context {
	// We don't want the server have any of the values in the client's context
	// since that can inadvertently leak state from the client to the server.
	// But we do want a child context, just so that request deadlines and client
	// cancellations work seamlessly.
	newCtx := context.Context(noValuesContext{ctx})

	if meta, ok := metadata.FromOutgoingContext(ctx); ok {
		newCtx = metadata.NewIncomingContext(newCtx, meta)
	}
	newCtx = peer.NewContext(newCtx, &inprocessPeer)
	newCtx = context.WithValue(newCtx, &clientContextKey, ctx)
	return newCtx
}

// ClientContext, when called on a server context, returns the original client context
// passed into Channel.Invoke() / Channel.NewStream().
func ClientContext(ctx context.Context) context.Context {
	if clientCtx, ok := ctx.Value(&clientContextKey).(context.Context); ok {
		return clientCtx
	}
	return nil
}

// noValuesContext wraps a context but prevents access to its values. This is
// useful when you need a child context only to propagate cancellations and
// deadlines, but explicitly *not* to propagate values.
type noValuesContext struct {
	context.Context
}

func (ctx noValuesContext) Value(_ interface{}) interface{} {
	return nil
}

type streamState int

const (
	streamStateHeaders streamState = iota
	streamStateMessages
	streamStateClosed
)

// NB(jh): The stream implementations below use a pattern where a Go channel is
// read from or written to while holding a mutex. This is done so that the
// channel operation is atomic with respect to updates to other stream state
// (and in some cases done to guarantee that a Go channel won't be closed more
// than once, which would result in a panic). Doing so under lock is safe in
// this case because it does not materially impact contention or reduce
// throughput due to the strict FIFO nature of a stream's contents. If a
// goroutine is blocked waiting on the mutex, that is likely because another
// goroutine is awaiting data from a channel. So the goroutine would have
// blocked, even without the mutex, because it too would have waited on the
// channel.
//
// To prevent the mutexes from causing real contention issues (or even
// deadlock), the "send" and "receive" channels will never be guarded by the
// same mutex.

// inProcessServerStream is the grpc.ServerStream implementation that is passed
// to server handlers when an in-process call is made. It uses channels to
// communicate request and response messages from/to the client (which runs in a
// separate goroutine).
type inProcessServerStream struct {
	ctx      context.Context
	onDone   context.CancelFunc
	cloner   Cloner
	requests <-chan frame

	mu        sync.Mutex
	headers   metadata.MD
	trailers  metadata.MD
	state     streamState
	responses chan<- frame // guarded by mu to prevent write-after-close panic
}

func (s *inProcessServerStream) SetHeader(md metadata.MD) error {
	return s.setHeader(md, false)
}

func (s *inProcessServerStream) SendHeader(md metadata.MD) error {
	return s.setHeader(md, true)
}

func (s *inProcessServerStream) setHeader(md metadata.MD, send bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state != streamStateHeaders {
		return fmt.Errorf("headers already sent")
	}
	if s.headers == nil {
		s.headers = metadata.MD{}
	}
	for k, v := range md {
		s.headers[k] = append(s.headers[k], v...)
	}
	if send {
		return s.sendHeadersLocked()
	}
	return nil
}

func (s *inProcessServerStream) sendHeadersLocked() error {
	if len(s.headers) > 0 {
		if err := writeMessage(s.ctx, nil, s.responses, frame{headers: s.headers}); err != nil {
			return err
		}
	}
	s.headers = nil
	s.state = streamStateMessages
	return nil
}

func (s *inProcessServerStream) finish(err error) {
	s.onDone()

	s.mu.Lock()
	defer func() {
		s.state = streamStateClosed
		close(s.responses)
		s.mu.Unlock()
	}()

	if s.state == streamStateHeaders && len(s.headers) > 0 {
		_ = writeMessage(s.ctx, nil, s.responses, frame{headers: s.headers})
	}

	if len(s.trailers) > 0 {
		_ = writeMessage(s.ctx, nil, s.responses, frame{trailers: s.trailers})
	}
	s.trailers = nil

	if err != nil {
		_ = writeMessage(s.ctx, nil, s.responses, frame{err: err})
	}
}

func (s *inProcessServerStream) SetTrailer(md metadata.MD) {
	_ = s.TrySetTrailer(md) // must ignore return value
}

func (s *inProcessServerStream) TrySetTrailer(md metadata.MD) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state == streamStateClosed {
		return fmt.Errorf("trailers already sent")
	}
	if s.trailers == nil {
		s.trailers = metadata.MD{}
	}
	for k, v := range md {
		s.trailers[k] = append(s.trailers[k], v...)
	}
	return nil
}

func (s *inProcessServerStream) Context() context.Context {
	return s.ctx
}

func (s *inProcessServerStream) SendMsg(m interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.ctx.Err() != nil || s.state == streamStateClosed {
		return io.EOF
	}
	if s.state == streamStateHeaders {
		if err := s.sendHeadersLocked(); err != nil {
			return err
		}
	}
	if isNil(m) {
		return status.Errorf(codes.Internal, "message to send is nil")
	}

	m, err := s.cloner.Clone(m)
	if err != nil {
		return err
	}
	return writeMessage(s.ctx, nil, s.responses, frame{data: m})
}

func (s *inProcessServerStream) RecvMsg(m interface{}) error {
	resp, err := readMessage(s.ctx, s.requests)
	if err != nil {
		return err
	}
	if resp.err != nil {
		return resp.err
	}
	return s.cloner.Copy(m, resp.data)
}

// inProcessClientStream is the grpc.ClientStream implementation returned to
// clients that call streaming methods via an in-process channel. It uses
// Go channels to communicate request and response messages to/from the server
// (which runs in a separate goroutine).
type inProcessClientStream struct {
	ctx            context.Context
	cloner         Cloner
	svrCtx         context.Context
	copts          *internal.CallOptions
	responseStream bool

	respMu    sync.Mutex
	responses <-chan frame // guarded by respMu so messages can be safely peeked into last
	state     streamState
	last      *frame
	headers   metadata.MD
	trailers  metadata.MD

	reqMu      sync.Mutex
	sendClosed bool
	requests   chan<- frame // guarded by reqMu to prevent write-after-close panic
}

func (s *inProcessClientStream) Header() (metadata.MD, error) {
	s.respMu.Lock()
	defer s.respMu.Unlock()

	if s.state == streamStateHeaders {
		m, err := readMessage(s.ctx, s.responses)
		if err != nil && err != io.EOF {
			return nil, err
		}
		if err == io.EOF {
			s.state = streamStateClosed
		} else {
			s.state = streamStateMessages
			switch m.kind() {
			case kindHeaders:
				s.headers = m.headers
				s.copts.SetHeaders(s.headers)
			case kindTrailers:
				s.trailers = m.trailers
				s.copts.SetTrailers(s.trailers)
			case kindError:
				s.state = streamStateClosed
				fallthrough
			default:
				// no headers; we need to save this frame so that subsequent
				// call to RecvMsg sees it
				s.last = &m
			}
		}
	}
	return s.headers, nil
}

func (s *inProcessClientStream) Trailer() metadata.MD {
	s.respMu.Lock()
	defer s.respMu.Unlock()

	return s.trailers
}

func (s *inProcessClientStream) CloseSend() error {
	s.reqMu.Lock()
	defer s.reqMu.Unlock()

	if !s.sendClosed {
		close(s.requests)
		s.sendClosed = true
	}
	return nil
}

func (s *inProcessClientStream) Context() context.Context {
	return s.ctx
}

func (s *inProcessClientStream) SendMsg(m interface{}) error {
	s.reqMu.Lock()
	defer s.reqMu.Unlock()

	if s.sendClosed {
		return fmt.Errorf("send closed")
	}
	if isNil(m) {
		return status.Errorf(codes.Internal, "message to send is nil")
	}

	m, err := s.cloner.Clone(m)
	if err != nil {
		return err
	}
	return writeMessage(s.ctx, s.svrCtx, s.requests, frame{data: m})
}

func (s *inProcessClientStream) RecvMsg(m interface{}) error {
	s.respMu.Lock()
	defer s.respMu.Unlock()
	return s.recvMsgLocked(m, !s.responseStream)
}

func (s *inProcessClientStream) recvMsgLocked(m interface{}, lastMessage bool) error {
	// handle peeked message (if there is one) first
	if s.last != nil {
		switch s.last.kind() {
		case kindData:
			err := s.cloner.Copy(m, s.last.data)
			if err == nil {
				s.last = nil
				if lastMessage {
					err = s.ensureNoMoreLocked(m)
				}
			}
			return err
		case kindError:
			s.state = streamStateClosed
			return internal.TranslateContextError(s.last.err)
		}
	}

	for {
		r, err := readMessage(s.ctx, s.responses)
		if err != nil {
			if err == io.EOF {
				s.state = streamStateClosed
			}
			return internal.TranslateContextError(err)
		}
		switch r.kind() {
		case kindHeaders:
			s.state = streamStateMessages
			s.headers = r.headers
			s.copts.SetHeaders(s.headers)
		case kindTrailers:
			s.trailers = r.trailers
			s.copts.SetTrailers(s.trailers)
		case kindError:
			s.state = streamStateClosed
			s.last = &r
			return internal.TranslateContextError(r.err)
		case kindData:
			err := s.cloner.Copy(m, r.data)
			if err == nil && lastMessage {
				err = s.ensureNoMoreLocked(m)
			}
			return err
		}
	}
}

func (s *inProcessClientStream) ensureNoMoreLocked(m interface{}) error {
	mCopy := reflect.New(reflect.TypeOf(m).Elem()).Interface()
	if err := s.recvMsgLocked(mCopy, false); err == nil {
		s.last = &frame{err: status.Error(codes.Internal, "method should return 1 response message but server sent >1")}
		s.state = streamStateClosed
		return s.last.err
	}
	return nil
}

func readMessage(ctx context.Context, ch <-chan frame) (frame, error) {
	select {
	case m, ok := <-ch:
		if err := ctx.Err(); err != nil {
			return frame{}, err
		}
		if !ok {
			return frame{}, io.EOF
		}
		return m, nil
	case <-ctx.Done():
		return frame{}, ctx.Err()
	}
}

func writeMessage(ctx, remoteCtx context.Context, ch chan<- frame, m frame) error {
	var remote <-chan struct{}
	if remoteCtx != nil {
		remote = remoteCtx.Done()
	}
	select {
	case ch <- m:
	case <-ctx.Done():
	case <-remote:
		// This is weird, but mimics normal gRPC streams: io.EOF is used
		// to notify client that server has closed the stream
		return io.EOF
	}
	return ctx.Err()
}

func isNil(m interface{}) bool {
	if m == nil {
		return true
	}
	rv := reflect.ValueOf(m)
	return rv.Kind() == reflect.Ptr && rv.IsNil()
}
