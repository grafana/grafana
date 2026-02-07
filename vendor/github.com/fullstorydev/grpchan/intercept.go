package grpchan

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
)

// WrappedClientConn is a channel that wraps another. It provides an Unwrap method
// for access the underlying wrapped implementation.
type WrappedClientConn interface {
	grpc.ClientConnInterface
	Unwrap() grpc.ClientConnInterface
}

// InterceptChannel returns a new channel that intercepts RPCs with the given
// interceptors. If both given interceptors are nil, returns ch. Otherwise, the
// returned value will implement WrappedClientConn and its Unwrap() method will
// return ch.
//
// Deprecated: Use InterceptClientConn instead.
func InterceptChannel(ch grpc.ClientConnInterface, unaryInt grpc.UnaryClientInterceptor, streamInt grpc.StreamClientInterceptor) grpc.ClientConnInterface {
	return InterceptClientConn(ch, unaryInt, streamInt)
}

// InterceptClientConn returns a new channel that intercepts RPCs with the given
// interceptors. If both given interceptors are nil, returns ch. Otherwise, the
// returned value will implement WrappedClientConn and its Unwrap() method will
// return ch.
func InterceptClientConn(ch grpc.ClientConnInterface, unaryInt grpc.UnaryClientInterceptor, streamInt grpc.StreamClientInterceptor) grpc.ClientConnInterface {
	if unaryInt == nil && streamInt == nil {
		return ch
	}
	return &interceptedChannel{ch: ch, unaryInt: unaryInt, streamInt: streamInt}
}

type interceptedChannel struct {
	ch        grpc.ClientConnInterface
	unaryInt  grpc.UnaryClientInterceptor
	streamInt grpc.StreamClientInterceptor
}

func (intch *interceptedChannel) Unwrap() grpc.ClientConnInterface {
	return intch.ch
}

func unwrap(ch grpc.ClientConnInterface) grpc.ClientConnInterface {
	// completely unwrap to find the root ClientConn
	for {
		w, ok := ch.(WrappedClientConn)
		if !ok {
			return ch
		}
		ch = w.Unwrap()
	}
}

func (intch *interceptedChannel) Invoke(ctx context.Context, methodName string, req, resp interface{}, opts ...grpc.CallOption) error {
	if intch.unaryInt == nil {
		return intch.ch.Invoke(ctx, methodName, req, resp, opts...)
	}
	cc, _ := unwrap(intch.ch).(*grpc.ClientConn)
	return intch.unaryInt(ctx, methodName, req, resp, cc, intch.unaryInvoker, opts...)
}

func (intch *interceptedChannel) unaryInvoker(ctx context.Context, methodName string, req, resp interface{}, cc *grpc.ClientConn, opts ...grpc.CallOption) error {
	return intch.ch.Invoke(ctx, methodName, req, resp, opts...)
}

func (intch *interceptedChannel) NewStream(ctx context.Context, desc *grpc.StreamDesc, methodName string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	if intch.streamInt == nil {
		return intch.ch.NewStream(ctx, desc, methodName, opts...)
	}
	cc, _ := intch.ch.(*grpc.ClientConn)
	return intch.streamInt(ctx, desc, cc, methodName, intch.streamer, opts...)
}

func (intch *interceptedChannel) streamer(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, methodName string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	return intch.ch.NewStream(ctx, desc, methodName, opts...)
}

var _ Channel = (*interceptedChannel)(nil)

// WithInterceptor returns a view of the given ServiceRegistry that will
// automatically apply the given interceptors to all registered services.
func WithInterceptor(reg ServiceRegistry, unaryInt grpc.UnaryServerInterceptor, streamInt grpc.StreamServerInterceptor) ServiceRegistry {
	if unaryInt == nil && streamInt == nil {
		return reg
	}
	return &interceptingRegistry{reg: reg, unaryInt: unaryInt, streamInt: streamInt}
}

type interceptingRegistry struct {
	reg       ServiceRegistry
	unaryInt  grpc.UnaryServerInterceptor
	streamInt grpc.StreamServerInterceptor
}

func (r *interceptingRegistry) RegisterService(desc *grpc.ServiceDesc, srv interface{}) {
	r.reg.RegisterService(InterceptServer(desc, r.unaryInt, r.streamInt), srv)
}

// InterceptServer returns a new service description that will intercepts RPCs
// with the given interceptors. If both given interceptors are nil, returns
// svcDesc.
func InterceptServer(svcDesc *grpc.ServiceDesc, unaryInt grpc.UnaryServerInterceptor, streamInt grpc.StreamServerInterceptor) *grpc.ServiceDesc {
	if unaryInt == nil && streamInt == nil {
		return svcDesc
	}
	intercepted := *svcDesc

	if unaryInt != nil {
		intercepted.Methods = make([]grpc.MethodDesc, len(svcDesc.Methods))
		for i, md := range svcDesc.Methods {
			origHandler := md.Handler
			intercepted.Methods[i] = grpc.MethodDesc{
				MethodName: md.MethodName,
				Handler: func(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
					combinedInterceptor := unaryInt
					if interceptor != nil {
						// combine unaryInt with the interceptor provided to handler
						combinedInterceptor = func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
							h := func(ctx context.Context, req interface{}) (interface{}, error) {
								return unaryInt(ctx, req, info, handler)
							}
							// we first call provided interceptor, but supply a handler that will call unaryInt
							return interceptor(ctx, req, info, h)
						}
					}
					return origHandler(srv, ctx, dec, combinedInterceptor)
				},
			}
		}
	}

	if streamInt != nil {
		intercepted.Streams = make([]grpc.StreamDesc, len(svcDesc.Streams))
		for i, sd := range svcDesc.Streams {
			origHandler := sd.Handler
			info := &grpc.StreamServerInfo{
				FullMethod:     fmt.Sprintf("/%s/%s", svcDesc.ServiceName, sd.StreamName),
				IsClientStream: sd.ClientStreams,
				IsServerStream: sd.ServerStreams,
			}
			intercepted.Streams[i] = grpc.StreamDesc{
				StreamName:    sd.StreamName,
				ClientStreams: sd.ClientStreams,
				ServerStreams: sd.ServerStreams,
				Handler: func(srv interface{}, stream grpc.ServerStream) error {
					return streamInt(srv, stream, info, origHandler)
				},
			}
		}
	}

	return &intercepted
}
