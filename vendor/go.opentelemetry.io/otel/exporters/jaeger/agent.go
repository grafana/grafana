// Copyright The OpenTelemetry Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger // import "go.opentelemetry.io/otel/exporters/jaeger"

import (
	"context"
	"fmt"
	"io"
	"net"
	"strings"
	"time"

	"github.com/go-logr/logr"

	genAgent "go.opentelemetry.io/otel/exporters/jaeger/internal/gen-go/agent"
	gen "go.opentelemetry.io/otel/exporters/jaeger/internal/gen-go/jaeger"
	"go.opentelemetry.io/otel/exporters/jaeger/internal/third_party/thrift/lib/go/thrift"
)

const (
	// udpPacketMaxLength is the max size of UDP packet we want to send, synced with jaeger-agent.
	udpPacketMaxLength = 65000
	// emitBatchOverhead is the additional overhead bytes used for enveloping the datagram,
	// synced with jaeger-agent https://github.com/jaegertracing/jaeger-client-go/blob/master/transport_udp.go#L37
	emitBatchOverhead = 70
)

// agentClientUDP is a UDP client to Jaeger agent that implements gen.Agent interface.
type agentClientUDP struct {
	genAgent.Agent
	io.Closer

	connUDP        udpConn
	client         *genAgent.AgentClient
	maxPacketSize  int                   // max size of datagram in bytes
	thriftBuffer   *thrift.TMemoryBuffer // buffer used to calculate byte size of a span
	thriftProtocol thrift.TProtocol
}

type udpConn interface {
	Write([]byte) (int, error)
	SetWriteBuffer(int) error
	Close() error
}

type agentClientUDPParams struct {
	Host                     string
	Port                     string
	MaxPacketSize            int
	Logger                   logr.Logger
	AttemptReconnecting      bool
	AttemptReconnectInterval time.Duration
}

// newAgentClientUDP creates a client that sends spans to Jaeger Agent over UDP.
func newAgentClientUDP(params agentClientUDPParams) (*agentClientUDP, error) {
	hostPort := net.JoinHostPort(params.Host, params.Port)
	// validate hostport
	if _, _, err := net.SplitHostPort(hostPort); err != nil {
		return nil, err
	}

	if params.MaxPacketSize <= 0 || params.MaxPacketSize > udpPacketMaxLength {
		params.MaxPacketSize = udpPacketMaxLength
	}

	if params.AttemptReconnecting && params.AttemptReconnectInterval <= 0 {
		params.AttemptReconnectInterval = time.Second * 30
	}

	thriftBuffer := thrift.NewTMemoryBufferLen(params.MaxPacketSize)
	protocolFactory := thrift.NewTCompactProtocolFactoryConf(&thrift.TConfiguration{})
	thriftProtocol := protocolFactory.GetProtocol(thriftBuffer)
	client := genAgent.NewAgentClientFactory(thriftBuffer, protocolFactory)

	var connUDP udpConn
	var err error

	if params.AttemptReconnecting {
		// host is hostname, setup resolver loop in case host record changes during operation
		connUDP, err = newReconnectingUDPConn(hostPort, params.MaxPacketSize, params.AttemptReconnectInterval, net.ResolveUDPAddr, net.DialUDP, params.Logger)
		if err != nil {
			return nil, err
		}
	} else {
		destAddr, err := net.ResolveUDPAddr("udp", hostPort)
		if err != nil {
			return nil, err
		}

		connUDP, err = net.DialUDP(destAddr.Network(), nil, destAddr)
		if err != nil {
			return nil, err
		}
	}

	if err := connUDP.SetWriteBuffer(params.MaxPacketSize); err != nil {
		return nil, err
	}

	return &agentClientUDP{
		connUDP:        connUDP,
		client:         client,
		maxPacketSize:  params.MaxPacketSize,
		thriftBuffer:   thriftBuffer,
		thriftProtocol: thriftProtocol,
	}, nil
}

// EmitBatch buffers batch to fit into UDP packets and sends the data to the agent.
func (a *agentClientUDP) EmitBatch(ctx context.Context, batch *gen.Batch) error {
	var errs []error
	processSize, err := a.calcSizeOfSerializedThrift(ctx, batch.Process)
	if err != nil {
		// drop the batch if serialization of process fails.
		return err
	}

	maxPacketSize := a.maxPacketSize
	if maxPacketSize > udpPacketMaxLength-emitBatchOverhead {
		maxPacketSize = udpPacketMaxLength - emitBatchOverhead
	}
	totalSize := processSize
	var spans []*gen.Span
	for _, span := range batch.Spans {
		spanSize, err := a.calcSizeOfSerializedThrift(ctx, span)
		if err != nil {
			errs = append(errs, fmt.Errorf("thrift serialization failed: %v", span))
			continue
		}
		if spanSize+processSize >= maxPacketSize {
			// drop the span that exceeds the limit.
			errs = append(errs, fmt.Errorf("span too large to send: %v", span))
			continue
		}
		if totalSize+spanSize >= maxPacketSize {
			if err := a.flush(ctx, &gen.Batch{
				Process: batch.Process,
				Spans:   spans,
			}); err != nil {
				errs = append(errs, err)
			}
			spans = spans[:0]
			totalSize = processSize
		}
		totalSize += spanSize
		spans = append(spans, span)
	}

	if len(spans) > 0 {
		if err := a.flush(ctx, &gen.Batch{
			Process: batch.Process,
			Spans:   spans,
		}); err != nil {
			errs = append(errs, err)
		}
	}

	if len(errs) == 1 {
		return errs[0]
	} else if len(errs) > 1 {
		joined := a.makeJoinedErrorString(errs)
		return fmt.Errorf("multiple errors during transform: %s", joined)
	}
	return nil
}

// makeJoinedErrorString join all the errors to one error message.
func (a *agentClientUDP) makeJoinedErrorString(errs []error) string {
	var errMsgs []string
	for _, err := range errs {
		errMsgs = append(errMsgs, err.Error())
	}
	return strings.Join(errMsgs, ", ")
}

// flush will send the batch of spans to the agent.
func (a *agentClientUDP) flush(ctx context.Context, batch *gen.Batch) error {
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

// calcSizeOfSerializedThrift calculate the serialized thrift packet size.
func (a *agentClientUDP) calcSizeOfSerializedThrift(ctx context.Context, thriftStruct thrift.TStruct) (int, error) {
	a.thriftBuffer.Reset()
	err := thriftStruct.Write(ctx, a.thriftProtocol)
	return a.thriftBuffer.Len(), err
}

// Close implements Close() of io.Closer and closes the underlying UDP connection.
func (a *agentClientUDP) Close() error {
	return a.connUDP.Close()
}
