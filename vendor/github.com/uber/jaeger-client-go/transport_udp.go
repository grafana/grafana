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

package jaeger

import (
	"errors"

	"github.com/apache/thrift/lib/go/thrift"

	j "github.com/uber/jaeger-client-go/thrift-gen/jaeger"
	"github.com/uber/jaeger-client-go/utils"
)

// Empirically obtained constant for how many bytes in the message are used for envelope.
// The total datagram size is:
// sizeof(Span) * numSpans + processByteSize + emitBatchOverhead <= maxPacketSize
// There is a unit test `TestEmitBatchOverhead` that validates this number.
// Note that due to the use of Compact Thrift protocol, overhead grows with the number of spans
// in the batch, because the length of the list is encoded as varint32, as well as SeqId.
const emitBatchOverhead = 30

const defaultUDPSpanServerHostPort = "localhost:6831"

var errSpanTooLarge = errors.New("Span is too large")

type udpSender struct {
	client          *utils.AgentClientUDP
	maxPacketSize   int                   // max size of datagram in bytes
	maxSpanBytes    int                   // max number of bytes to record spans (excluding envelope) in the datagram
	byteBufferSize  int                   // current number of span bytes accumulated in the buffer
	spanBuffer      []*j.Span             // spans buffered before a flush
	thriftBuffer    *thrift.TMemoryBuffer // buffer used to calculate byte size of a span
	thriftProtocol  thrift.TProtocol
	process         *j.Process
	processByteSize int
}

// NewUDPTransport creates a reporter that submits spans to jaeger-agent
func NewUDPTransport(hostPort string, maxPacketSize int) (Transport, error) {
	if len(hostPort) == 0 {
		hostPort = defaultUDPSpanServerHostPort
	}
	if maxPacketSize == 0 {
		maxPacketSize = utils.UDPPacketMaxLength
	}

	protocolFactory := thrift.NewTCompactProtocolFactory()

	// Each span is first written to thriftBuffer to determine its size in bytes.
	thriftBuffer := thrift.NewTMemoryBufferLen(maxPacketSize)
	thriftProtocol := protocolFactory.GetProtocol(thriftBuffer)

	client, err := utils.NewAgentClientUDP(hostPort, maxPacketSize)
	if err != nil {
		return nil, err
	}

	sender := &udpSender{
		client:         client,
		maxSpanBytes:   maxPacketSize - emitBatchOverhead,
		thriftBuffer:   thriftBuffer,
		thriftProtocol: thriftProtocol}
	return sender, nil
}

func (s *udpSender) calcSizeOfSerializedThrift(thriftStruct thrift.TStruct) int {
	s.thriftBuffer.Reset()
	thriftStruct.Write(s.thriftProtocol)
	return s.thriftBuffer.Len()
}

func (s *udpSender) Append(span *Span) (int, error) {
	if s.process == nil {
		s.process = BuildJaegerProcessThrift(span)
		s.processByteSize = s.calcSizeOfSerializedThrift(s.process)
		s.byteBufferSize += s.processByteSize
	}
	jSpan := BuildJaegerThrift(span)
	spanSize := s.calcSizeOfSerializedThrift(jSpan)
	if spanSize > s.maxSpanBytes {
		return 1, errSpanTooLarge
	}

	s.byteBufferSize += spanSize
	if s.byteBufferSize <= s.maxSpanBytes {
		s.spanBuffer = append(s.spanBuffer, jSpan)
		if s.byteBufferSize < s.maxSpanBytes {
			return 0, nil
		}
		return s.Flush()
	}
	// the latest span did not fit in the buffer
	n, err := s.Flush()
	s.spanBuffer = append(s.spanBuffer, jSpan)
	s.byteBufferSize = spanSize + s.processByteSize
	return n, err
}

func (s *udpSender) Flush() (int, error) {
	n := len(s.spanBuffer)
	if n == 0 {
		return 0, nil
	}
	err := s.client.EmitBatch(&j.Batch{Process: s.process, Spans: s.spanBuffer})
	s.resetBuffers()

	return n, err
}

func (s *udpSender) Close() error {
	return s.client.Close()
}

func (s *udpSender) resetBuffers() {
	for i := range s.spanBuffer {
		s.spanBuffer[i] = nil
	}
	s.spanBuffer = s.spanBuffer[:0]
	s.byteBufferSize = s.processByteSize
}
