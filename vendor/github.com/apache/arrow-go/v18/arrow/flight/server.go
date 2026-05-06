// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package flight

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"

	"github.com/apache/arrow-go/v18/arrow/flight/gen/flight"
	"google.golang.org/grpc"
)

type (
	FlightServer                    = flight.FlightServiceServer
	FlightService_HandshakeServer   = flight.FlightService_HandshakeServer
	HandshakeResponse               = flight.HandshakeResponse
	HandshakeRequest                = flight.HandshakeRequest
	FlightService_ListFlightsServer = flight.FlightService_ListFlightsServer
	FlightService_DoGetServer       = flight.FlightService_DoGetServer
	FlightService_DoPutServer       = flight.FlightService_DoPutServer
	FlightService_DoExchangeServer  = flight.FlightService_DoExchangeServer
	FlightService_DoActionServer    = flight.FlightService_DoActionServer
	FlightService_ListActionsServer = flight.FlightService_ListActionsServer
	Criteria                        = flight.Criteria
	FlightDescriptor                = flight.FlightDescriptor
	FlightEndpoint                  = flight.FlightEndpoint
	Location                        = flight.Location
	FlightInfo                      = flight.FlightInfo
	PollInfo                        = flight.PollInfo
	FlightData                      = flight.FlightData
	PutResult                       = flight.PutResult
	Ticket                          = flight.Ticket
	SchemaResult                    = flight.SchemaResult
	Action                          = flight.Action
	ActionType                      = flight.ActionType
	CancelFlightInfoRequest         = flight.CancelFlightInfoRequest
	RenewFlightEndpointRequest      = flight.RenewFlightEndpointRequest
	Result                          = flight.Result
	CancelFlightInfoResult          = flight.CancelFlightInfoResult
	CancelStatus                    = flight.CancelStatus
	SessionOptionValue              = flight.SessionOptionValue
	SetSessionOptionsRequest        = flight.SetSessionOptionsRequest
	SetSessionOptionsResult         = flight.SetSessionOptionsResult
	SetSessionOptionsResultError    = flight.SetSessionOptionsResult_Error
	GetSessionOptionsRequest        = flight.GetSessionOptionsRequest
	GetSessionOptionsResult         = flight.GetSessionOptionsResult
	CloseSessionRequest             = flight.CloseSessionRequest
	CloseSessionResult              = flight.CloseSessionResult
	Empty                           = flight.Empty
)

// Constants for Action types
const (
	CancelFlightInfoActionType    = "CancelFlightInfo"
	RenewFlightEndpointActionType = "RenewFlightEndpoint"
	SetSessionOptionsActionType   = "SetSessionOptions"
	GetSessionOptionsActionType   = "GetSessionOptions"
	CloseSessionActionType        = "CloseSession"
)

const (
	// The set option error is unknown. Servers should avoid
	// using this value (send a NOT_FOUND error if the requested
	// FlightInfo is not known). Clients can retry the request.
	SetSessionOptionsResultErrorUnspecified = flight.SetSessionOptionsResult_UNSPECIFIED
	// The given session option name is invalid.
	SetSessionOptionsResultErrorInvalidName = flight.SetSessionOptionsResult_INVALID_NAME
	// The session option value or type is invalid.
	SetSessionOptionsResultErrorInvalidValue = flight.SetSessionOptionsResult_INVALID_VALUE
	// The session option cannot be set.
	SetSessionOptionsResultErrorError = flight.SetSessionOptionsResult_ERROR
)

const (
	// The close session status is unknown. Servers should avoid
	// using this value (send a NOT_FOUND error if the requested
	// FlightInfo is not known). Clients can retry the request.
	CloseSessionResultUnspecified = flight.CloseSessionResult_UNSPECIFIED
	// The session close request is complete.
	CloseSessionResultClosed = flight.CloseSessionResult_CLOSED
	// The session close request is in progress. The client may retry the request.
	CloseSessionResultClosing = flight.CloseSessionResult_CLOSING
	// The session is not closeable.
	CloseSessionResultNotCloseable = flight.CloseSessionResult_NOT_CLOSEABLE
)

// NewSessionOptionValues returns a map with the same keys as the input map, but with all values converted
// to SessionOptionValues. If any values fail conversion, an error will be returned.
func NewSessionOptionValues(options map[string]any) (map[string]*flight.SessionOptionValue, error) {
	sessionOptions := make(map[string]*flight.SessionOptionValue, len(options))
	for key, val := range options {
		optval, err := NewSessionOptionValue(val)
		if err != nil {
			return nil, err
		}
		sessionOptions[key] = &optval
	}

	return sessionOptions, nil
}

// NewSessionOptionValue takes any value and constructs a SessionOptionValue suitable for setting session values.
// An error will be returned if the value is not one of the types supported by SessionOptionValue.
func NewSessionOptionValue(value any) (flight.SessionOptionValue, error) {
	if value == nil {
		return flight.SessionOptionValue{}, nil
	}

	switch val := value.(type) {
	case string:
		return flight.SessionOptionValue{OptionValue: &flight.SessionOptionValue_StringValue{StringValue: val}}, nil
	case bool:
		return flight.SessionOptionValue{OptionValue: &flight.SessionOptionValue_BoolValue{BoolValue: val}}, nil
	case int64:
		return flight.SessionOptionValue{OptionValue: &flight.SessionOptionValue_Int64Value{Int64Value: val}}, nil
	case float64:
		return flight.SessionOptionValue{OptionValue: &flight.SessionOptionValue_DoubleValue{DoubleValue: val}}, nil
	case []string:
		return flight.SessionOptionValue{OptionValue: &flight.SessionOptionValue_StringListValue_{StringListValue: &flight.SessionOptionValue_StringListValue{Values: val}}}, nil
	default:
		return flight.SessionOptionValue{}, fmt.Errorf("invalid option type %[1]T for value %[1]v", val)
	}
}

// Constants for CancelStatus
const (
	// The cancellation status is unknown. Servers should avoid
	// using this value (send a NOT_FOUND error if the requested
	// FlightInfo is not known). Clients can retry the request.
	CancelStatusUnspecified = flight.CancelStatus_CANCEL_STATUS_UNSPECIFIED
	// The cancellation request is complete. Subsequent requests
	// with the same payload may return CancelStatusCancelled or a
	// arrow.ErrNotFound error.
	CancelStatusCancelled = flight.CancelStatus_CANCEL_STATUS_CANCELLED
	// The cancellation request is in progress. The client may
	// retry the cancellation request.
	CancelStatusCancelling = flight.CancelStatus_CANCEL_STATUS_CANCELLING
	// The FlightInfo is not cancellable. The client should not
	// retry the cancellation request.
	CancelStatusNotCancellable = flight.CancelStatus_CANCEL_STATUS_NOT_CANCELLABLE
)

// Constants for Location
const (
	// LocationReuseConnection is a special location that tells clients
	// they may fetch the data from the same service that they obtained
	// the FlightEndpoint response from.
	LocationReuseConnection = "arrow-flight-reuse-connection://?"
)

// RegisterFlightServiceServer registers an existing flight server onto an
// existing grpc server, or anything that is a grpc service registrar.
func RegisterFlightServiceServer(s *grpc.Server, srv FlightServer) {
	flight.RegisterFlightServiceServer(s, srv)
}

// From https://github.com/grpc/grpc-go/blob/4c776ec01572d55249df309251900554b46adb41/reflection/serverreflection.go#L69-L83
// This interface is inlined to make this arrow library compatible with
// grpc < 1.45 .
// See "google.golang.org/grpc/reflection" 's reflection.ServiceInfoProvider .
// serviceInfoProvider is an interface used to retrieve metadata about the
// services to expose.
//
// The reflection service is only interested in the service names, but the
// signature is this way so that *grpc.Server implements it. So it is okay
// for a custom implementation to return zero values for the
// grpc.ServiceInfo values in the map.
//
// # Experimental
//
// Notice: This type is EXPERIMENTAL and may be changed or removed in a
// later release.
type serviceInfoProvider interface {
	GetServiceInfo() map[string]grpc.ServiceInfo
}

// Server is an interface for hiding some of the grpc specifics to make
// it slightly easier to manage a flight service, slightly modeled after
// the C++ implementation
type Server interface {
	// Init takes in the address to bind to and creates the listener. If both this
	// and InitListener are called, then whichever was called last will be used.
	Init(addr string) error
	// InitListener initializes with an already created listener rather than
	// creating a new one like Init does. If both this and Init are called,
	// whichever was called last is what will be used as they both set a listener
	// into the server.
	InitListener(lis net.Listener)
	// Addr will return the address that was bound to for the service to listen on
	Addr() net.Addr
	// SetShutdownOnSignals sets notifications on the given signals to call GracefulStop
	// on the grpc service if any of those signals are received
	SetShutdownOnSignals(sig ...os.Signal)
	// Serve blocks until accepting a connection fails with a fatal error. It will return
	// a non-nil error unless it stopped due to calling Shutdown or receiving one of the
	// signals set in SetShutdownOnSignals
	Serve() error
	// Shutdown will call GracefulStop on the grpc server so that it stops accepting connections
	// and will wait until current methods complete
	Shutdown()
	// RegisterFlightService sets up the handler for the Flight Endpoints as per
	// normal Grpc setups
	RegisterFlightService(FlightServer)
	// ServiceRegistrar wraps a single method that supports service registration.
	// For example, it may be used to register health check provided by grpc-go.
	grpc.ServiceRegistrar
	// serviceInfoProvider is an interface used to retrieve metadata about the services to expose.
	// If reflection is enabled on the server, all the endpoints can be invoked using grpcurl.
	serviceInfoProvider
}

// BaseFlightServer is the base flight server implementation and must be
// embedded in any server implementation to ensure forward compatibility
// with any modifications of the spec without compiler errors.
type BaseFlightServer struct {
	flight.UnimplementedFlightServiceServer
	authHandler ServerAuthHandler
}

func (s *BaseFlightServer) GetAuthHandler() ServerAuthHandler { return s.authHandler }

func (s *BaseFlightServer) SetAuthHandler(handler ServerAuthHandler) {
	s.authHandler = handler
}

func (s *BaseFlightServer) Handshake(stream flight.FlightService_HandshakeServer) error {
	if s.authHandler == nil {
		return nil
	}

	return s.authHandler.Authenticate(&serverAuthConn{stream})
}

// CustomerServerMiddleware is a helper interface for more easily defining custom
// grpc middleware without having to expose or understand all the grpc bells and whistles.
type CustomServerMiddleware interface {
	// StartCall will be called with the current context of the call, grpc.SetHeader can be used to add outgoing headers
	// if the returned context is non-nil, then it will be used as the new context being passed through the calls
	StartCall(ctx context.Context) context.Context
	// CallCompleted is a callback which is called with the return from the handler
	// it will be nil if everything was successful or will be the error about to be returned
	// to grpc
	CallCompleted(ctx context.Context, err error)
}

// CreateServerMiddlware constructs a ServerMiddleware object for the passed in custom
// middleware, generating both the Unary and Stream interceptors from the interface.
func CreateServerMiddleware(middleware CustomServerMiddleware) ServerMiddleware {
	return ServerMiddleware{
		Unary: func(ctx context.Context, req interface{}, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (ret interface{}, err error) {
			nctx := middleware.StartCall(ctx)
			if nctx != nil {
				ctx = nctx
			}

			ret, err = handler(ctx, req)
			middleware.CallCompleted(ctx, err)
			return
		},
		Stream: func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
			ctx := middleware.StartCall(stream.Context())
			if ctx != nil {
				stream = &wrappedStream{ServerStream: stream, ctx: ctx}
			}

			err := handler(srv, stream)
			middleware.CallCompleted(stream.Context(), err)
			return err
		},
	}
}

type ServerMiddleware struct {
	Stream grpc.StreamServerInterceptor
	Unary  grpc.UnaryServerInterceptor
}

type server struct {
	lis        net.Listener
	sigChannel <-chan os.Signal
	done       chan bool

	server *grpc.Server
}

// NewFlightServer takes any grpc Server options desired, such as TLS certs and so
// on which will just be passed through to the underlying grpc server.
//
// Alternatively, a grpc server can be created normally without this helper as the
// grpc server generated code is still being exported. This only exists to allow
// the utility of the helpers
//
// Deprecated: prefer to use NewServerWithMiddleware, due to auth handler middleware
// this function will be problematic if any of the grpc options specify other middleware.
func NewFlightServer(opt ...grpc.ServerOption) Server {
	opt = append([]grpc.ServerOption{
		grpc.ChainStreamInterceptor(serverAuthStreamInterceptor),
		grpc.ChainUnaryInterceptor(serverAuthUnaryInterceptor),
	}, opt...)

	return &server{
		server: grpc.NewServer(opt...),
	}
}

// NewServerWithMiddleware takes a slice of middleware which will be used
// by grpc and chained, the first middleware will be the outer most with the last
// middleware being the inner most wrapper around the actual call. It also takes
// any grpc Server options desired, such as TLS certs and so on which will just
// be passed through to the underlying grpc server.
//
// Because of the usage of `ChainStreamInterceptor` and `ChainUnaryInterceptor` do
// not specify any middleware using the grpc options, use the ServerMiddleware slice
// instead as the auth middleware will be added for handling the case that a service
// handler is registered that uses the ServerAuthHandler.
//
// Alternatively, a grpc server can be created normally without this helper as the
// grpc server generated code is still being exported. This only exists to allow
// the utility of the helpers.
func NewServerWithMiddleware(middleware []ServerMiddleware, opts ...grpc.ServerOption) Server {
	unary := make([]grpc.UnaryServerInterceptor, 1, len(middleware)+1)
	unary[0] = serverAuthUnaryInterceptor
	stream := make([]grpc.StreamServerInterceptor, 1, len(middleware)+1)
	stream[0] = serverAuthStreamInterceptor

	if len(middleware) > 0 {
		for _, m := range middleware {
			if m.Unary != nil {
				unary = append(unary, m.Unary)
			}
			if m.Stream != nil {
				stream = append(stream, m.Stream)
			}
		}
	}
	opts = append(opts, grpc.ChainUnaryInterceptor(unary...), grpc.ChainStreamInterceptor(stream...))

	return &server{server: grpc.NewServer(opts...)}
}

func (s *server) Init(addr string) (err error) {
	s.lis, err = net.Listen("tcp", addr)
	return
}

func (s *server) InitListener(lis net.Listener) {
	s.lis = lis
}

func (s *server) Addr() net.Addr {
	return s.lis.Addr()
}

func (s *server) SetShutdownOnSignals(sig ...os.Signal) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, sig...)
	s.sigChannel = c
}

func (s *server) Serve() error {
	s.done = make(chan bool)
	go func() {
		select {
		case <-s.sigChannel:
			s.server.GracefulStop()
		case <-s.done:
		}
	}()
	err := s.server.Serve(s.lis)
	close(s.done)
	return err
}

func (s *server) RegisterFlightService(svc FlightServer) {
	flight.RegisterFlightServiceServer(s.server, svc)
}

func (s *server) Shutdown() {
	s.server.GracefulStop()
}

func (s *server) RegisterService(sd *grpc.ServiceDesc, ss interface{}) {
	s.server.RegisterService(sd, ss)
}

func (s *server) GetServiceInfo() map[string]grpc.ServiceInfo {
	return s.server.GetServiceInfo()
}
