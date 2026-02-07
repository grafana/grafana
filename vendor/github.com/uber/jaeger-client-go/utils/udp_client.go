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

package utils

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/thrift"

	"github.com/uber/jaeger-client-go/thrift-gen/agent"
	"github.com/uber/jaeger-client-go/thrift-gen/jaeger"
	"github.com/uber/jaeger-client-go/thrift-gen/zipkincore"
)

// UDPPacketMaxLength is the max size of UDP packet we want to send, synced with jaeger-agent
const UDPPacketMaxLength = 65000

// AgentClientUDP is a UDP client to Jaeger agent that implements agent.Agent interface.
type AgentClientUDP struct {
	agent.Agent
	io.Closer

	connUDP       udpConn
	client        *agent.AgentClient
	maxPacketSize int                   // max size of datagram in bytes
	thriftBuffer  *thrift.TMemoryBuffer // buffer used to calculate byte size of a span
}

type udpConn interface {
	Write([]byte) (int, error)
	SetWriteBuffer(int) error
	Close() error
}

// AgentClientUDPParams allows specifying options for initializing an AgentClientUDP. An instance of this struct should
// be passed to NewAgentClientUDPWithParams.
type AgentClientUDPParams struct {
	HostPort                   string
	MaxPacketSize              int
	Logger                     log.Logger
	DisableAttemptReconnecting bool
	AttemptReconnectInterval   time.Duration
}

// NewAgentClientUDPWithParams creates a client that sends spans to Jaeger Agent over UDP.
func NewAgentClientUDPWithParams(params AgentClientUDPParams) (*AgentClientUDP, error) {
	// validate hostport
	if _, _, err := net.SplitHostPort(params.HostPort); err != nil {
		return nil, err
	}

	if params.MaxPacketSize == 0 {
		params.MaxPacketSize = UDPPacketMaxLength
	}

	if params.Logger == nil {
		params.Logger = log.StdLogger
	}

	if !params.DisableAttemptReconnecting && params.AttemptReconnectInterval == 0 {
		params.AttemptReconnectInterval = time.Second * 30
	}

	thriftBuffer := thrift.NewTMemoryBufferLen(params.MaxPacketSize)
	protocolFactory := thrift.NewTCompactProtocolFactory()
	client := agent.NewAgentClientFactory(thriftBuffer, protocolFactory)

	var connUDP udpConn
	var err error

	if params.DisableAttemptReconnecting {
		destAddr, err := net.ResolveUDPAddr("udp", params.HostPort)
		if err != nil {
			return nil, err
		}

		connUDP, err = net.DialUDP(destAddr.Network(), nil, destAddr)
		if err != nil {
			return nil, err
		}
	} else {
		// host is hostname, setup resolver loop in case host record changes during operation
		connUDP, err = newReconnectingUDPConn(params.HostPort, params.AttemptReconnectInterval, net.ResolveUDPAddr, net.DialUDP, params.Logger)
		if err != nil {
			return nil, err
		}
	}

	if err := connUDP.SetWriteBuffer(params.MaxPacketSize); err != nil {
		return nil, err
	}

	return &AgentClientUDP{
		connUDP:       connUDP,
		client:        client,
		maxPacketSize: params.MaxPacketSize,
		thriftBuffer:  thriftBuffer,
	}, nil
}

// NewAgentClientUDP creates a client that sends spans to Jaeger Agent over UDP.
func NewAgentClientUDP(hostPort string, maxPacketSize int) (*AgentClientUDP, error) {
	return NewAgentClientUDPWithParams(AgentClientUDPParams{
		HostPort:      hostPort,
		MaxPacketSize: maxPacketSize,
	})
}

// EmitZipkinBatch implements EmitZipkinBatch() of Agent interface
func (a *AgentClientUDP) EmitZipkinBatch(context.Context, []*zipkincore.Span) error {
	return errors.New("Not implemented")
}

// EmitBatch implements EmitBatch() of Agent interface
func (a *AgentClientUDP) EmitBatch(ctx context.Context, batch *jaeger.Batch) error {
	a.thriftBuffer.Reset()
	if err := a.client.EmitBatch(ctx, batch); err != nil {
		return err
	}
	if a.thriftBuffer.Len() > a.maxPacketSize {
		return fmt.Errorf("data does not fit within one UDP packet; size %d, max %d, spans %d",
			a.thriftBuffer.Len(), a.maxPacketSize, len(batch.Spans))
	}
	_, err := a.connUDP.Write(a.thriftBuffer.Bytes())
	return err
}

// Close implements Close() of io.Closer and closes the underlying UDP connection.
func (a *AgentClientUDP) Close() error {
	return a.connUDP.Close()
}
