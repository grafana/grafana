// Copyright (c) 2017 Uber Technologies, Inc.
//
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

package server

import (
	"fmt"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/uber/tchannel-go"
	"github.com/uber/tchannel-go/thrift"
	"golang.org/x/net/context"

	"github.com/uber/jaeger-client-go/crossdock/log"
	"github.com/uber/jaeger-client-go/crossdock/thrift/tracetest"
)

func (s *Server) startTChannelServer(tracer opentracing.Tracer) error {
	channelOpts := &tchannel.ChannelOptions{
		Tracer: tracer,
	}
	ch, err := tchannel.NewChannel("go", channelOpts)
	if err != nil {
		return err
	}
	server := thrift.NewServer(ch)

	s.channel = ch

	handler := tracetest.NewTChanTracedServiceServer(s)
	server.Register(handler)

	if err := ch.ListenAndServe(s.HostPortTChannel); err != nil {
		return err
	}
	s.HostPortTChannel = ch.PeerInfo().HostPort
	log.Printf("Started tchannel server at %s\n", s.HostPortTChannel)
	return nil
}

// StartTrace implements StartTrace() of TChanTracedService
func (s *Server) StartTrace(ctx thrift.Context, request *tracetest.StartTraceRequest) (*tracetest.TraceResponse, error) {
	return nil, errCannotStartInTChannel
}

// JoinTrace implements JoinTrace() of TChanTracedService
func (s *Server) JoinTrace(ctx thrift.Context, request *tracetest.JoinTraceRequest) (*tracetest.TraceResponse, error) {
	log.Printf("tchannel server handling JoinTrace")
	return s.prepareResponse(ctx, request.ServerRole, request.Downstream)
}

func (s *Server) callDownstreamTChannel(ctx context.Context, target *tracetest.Downstream) (*tracetest.TraceResponse, error) {
	req := &tracetest.JoinTraceRequest{
		ServerRole: target.ServerRole,
		Downstream: target.Downstream,
	}

	hostPort := fmt.Sprintf("%s:%s", target.Host, target.Port)
	log.Printf("calling downstream '%s' over tchannel:%s", target.ServiceName, hostPort)

	channelOpts := &tchannel.ChannelOptions{
		Tracer: s.Tracer,
	}
	ch, err := tchannel.NewChannel("tchannel-client", channelOpts)
	if err != nil {
		return nil, err
	}

	opts := &thrift.ClientOptions{HostPort: hostPort}
	thriftClient := thrift.NewClient(ch, target.ServiceName, opts)

	client := tracetest.NewTChanTracedServiceClient(thriftClient)
	ctx, cx := context.WithTimeout(ctx, time.Second)
	defer cx()
	return client.JoinTrace(thrift.Wrap(ctx), req)
}
