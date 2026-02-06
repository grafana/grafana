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
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// ClientAuthHandler defines an interface for the Flight client to perform
// the authentication handshake. The token that is retrieved from GetToken
// will be sent as part of the context metadata in subsequent requests after
// authentication is performed using the key "auth-token-bin".
type ClientAuthHandler interface {
	Authenticate(context.Context, AuthConn) error
	GetToken(context.Context) (string, error)
}

type clientAuthConn struct {
	stream FlightService_HandshakeClient
}

func (a *clientAuthConn) Read() ([]byte, error) {
	in, err := a.stream.Recv()
	if err != nil {
		return nil, err
	}

	return in.Payload, nil
}

func (a *clientAuthConn) Send(b []byte) error {
	return a.stream.Send(&HandshakeRequest{Payload: b})
}

func createClientAuthUnaryInterceptor(auth ClientAuthHandler) grpc.UnaryClientInterceptor {
	if auth == nil {
		return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
			return invoker(ctx, method, req, reply, cc, opts...)
		}
	}

	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		tok, err := auth.GetToken(ctx)
		if err != nil {
			return status.Errorf(codes.Unauthenticated, "error retrieving token: %s", err)
		}

		return invoker(metadata.AppendToOutgoingContext(ctx, grpcAuthHeader, tok), method, req, reply, cc, opts...)
	}
}

func createClientAuthStreamInterceptor(auth ClientAuthHandler) grpc.StreamClientInterceptor {
	if auth == nil {
		return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
			return streamer(ctx, desc, cc, method, opts...)
		}
	}

	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		if strings.HasSuffix(method, "/Handshake") {
			return streamer(ctx, desc, cc, method, opts...)
		}

		tok, err := auth.GetToken(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Unauthenticated, "error retrieving token: %s", err)
		}

		return streamer(metadata.AppendToOutgoingContext(ctx, grpcAuthHeader, tok), desc, cc, method, opts...)
	}
}
