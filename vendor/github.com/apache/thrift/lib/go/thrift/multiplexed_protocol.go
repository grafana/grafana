/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package thrift

import (
	"context"
	"fmt"
	"strings"
)

/*
TMultiplexedProtocol is a protocol-independent concrete decorator
that allows a Thrift client to communicate with a multiplexing Thrift server,
by prepending the service name to the function name during function calls.

NOTE: THIS IS NOT USED BY SERVERS.  On the server, use TMultiplexedProcessor to handle request
from a multiplexing client.

This example uses a single socket transport to invoke two services:

socket := thrift.NewTSocketFromAddrTimeout(addr, TIMEOUT)
transport := thrift.NewTFramedTransport(socket)
protocol := thrift.NewTBinaryProtocolTransport(transport)

mp := thrift.NewTMultiplexedProtocol(protocol, "Calculator")
service := Calculator.NewCalculatorClient(mp)

mp2 := thrift.NewTMultiplexedProtocol(protocol, "WeatherReport")
service2 := WeatherReport.NewWeatherReportClient(mp2)

err := transport.Open()
if err != nil {
	t.Fatal("Unable to open client socket", err)
}

fmt.Println(service.Add(2,2))
fmt.Println(service2.GetTemperature())
*/

type TMultiplexedProtocol struct {
	TProtocol
	serviceName string
}

const MULTIPLEXED_SEPARATOR = ":"

func NewTMultiplexedProtocol(protocol TProtocol, serviceName string) *TMultiplexedProtocol {
	return &TMultiplexedProtocol{
		TProtocol:   protocol,
		serviceName: serviceName,
	}
}

func (t *TMultiplexedProtocol) WriteMessageBegin(ctx context.Context, name string, typeId TMessageType, seqid int32) error {
	if typeId == CALL || typeId == ONEWAY {
		return t.TProtocol.WriteMessageBegin(ctx, t.serviceName+MULTIPLEXED_SEPARATOR+name, typeId, seqid)
	} else {
		return t.TProtocol.WriteMessageBegin(ctx, name, typeId, seqid)
	}
}

/*
TMultiplexedProcessor is a TProcessor allowing
a single TServer to provide multiple services.

To do so, you instantiate the processor and then register additional
processors with it, as shown in the following example:

var processor = thrift.NewTMultiplexedProcessor()

firstProcessor :=
processor.RegisterProcessor("FirstService", firstProcessor)

processor.registerProcessor(
  "Calculator",
  Calculator.NewCalculatorProcessor(&CalculatorHandler{}),
)

processor.registerProcessor(
  "WeatherReport",
  WeatherReport.NewWeatherReportProcessor(&WeatherReportHandler{}),
)

serverTransport, err := thrift.NewTServerSocketTimeout(addr, TIMEOUT)
if err != nil {
  t.Fatal("Unable to create server socket", err)
}
server := thrift.NewTSimpleServer2(processor, serverTransport)
server.Serve();
*/

type TMultiplexedProcessor struct {
	serviceProcessorMap map[string]TProcessor
	DefaultProcessor    TProcessor
}

func NewTMultiplexedProcessor() *TMultiplexedProcessor {
	return &TMultiplexedProcessor{
		serviceProcessorMap: make(map[string]TProcessor),
	}
}

// ProcessorMap returns a mapping of "{ProcessorName}{MULTIPLEXED_SEPARATOR}{FunctionName}"
// to TProcessorFunction for any registered processors.  If there is also a
// DefaultProcessor, the keys for the methods on that processor will simply be
// "{FunctionName}".  If the TMultiplexedProcessor has both a DefaultProcessor and
// other registered processors, then the keys will be a mix of both formats.
//
// The implementation differs with other TProcessors in that the map returned is
// a new map, while most TProcessors just return their internal mapping directly.
// This means that edits to the map returned by this implementation of ProcessorMap
// will not affect the underlying mapping within the TMultiplexedProcessor.
func (t *TMultiplexedProcessor) ProcessorMap() map[string]TProcessorFunction {
	processorFuncMap := make(map[string]TProcessorFunction)
	for name, processor := range t.serviceProcessorMap {
		for method, processorFunc := range processor.ProcessorMap() {
			processorFuncName := name + MULTIPLEXED_SEPARATOR + method
			processorFuncMap[processorFuncName] = processorFunc
		}
	}
	if t.DefaultProcessor != nil {
		for method, processorFunc := range t.DefaultProcessor.ProcessorMap() {
			processorFuncMap[method] = processorFunc
		}
	}
	return processorFuncMap
}

// AddToProcessorMap updates the underlying TProcessor ProccessorMaps depending on
// the format of "name".
//
// If "name" is in the format "{ProcessorName}{MULTIPLEXED_SEPARATOR}{FunctionName}",
// then it sets the given TProcessorFunction on the inner TProcessor with the
// ProcessorName component using the FunctionName component.
//
// If "name" is just in the format "{FunctionName}", that is to say there is no
// MULTIPLEXED_SEPARATOR, and the TMultiplexedProcessor has a DefaultProcessor
// configured, then it will set the given TProcessorFunction on the DefaultProcessor
// using the given name.
//
// If there is not a TProcessor available for the given name, then this function
// does nothing.  This can happen when there is no TProcessor registered for
// the given ProcessorName or if all that is given is the FunctionName and there
// is no DefaultProcessor set.
func (t *TMultiplexedProcessor) AddToProcessorMap(name string, processorFunc TProcessorFunction) {
	components := strings.SplitN(name, MULTIPLEXED_SEPARATOR, 2)
	if len(components) != 2 {
		if t.DefaultProcessor != nil && len(components) == 1 {
			t.DefaultProcessor.AddToProcessorMap(components[0], processorFunc)
		}
		return
	}
	processorName := components[0]
	funcName := components[1]
	if processor, ok := t.serviceProcessorMap[processorName]; ok {
		processor.AddToProcessorMap(funcName, processorFunc)
	}

}

// verify that TMultiplexedProcessor implements TProcessor
var _ TProcessor = (*TMultiplexedProcessor)(nil)

func (t *TMultiplexedProcessor) RegisterDefault(processor TProcessor) {
	t.DefaultProcessor = processor
}

func (t *TMultiplexedProcessor) RegisterProcessor(name string, processor TProcessor) {
	if t.serviceProcessorMap == nil {
		t.serviceProcessorMap = make(map[string]TProcessor)
	}
	t.serviceProcessorMap[name] = processor
}

func (t *TMultiplexedProcessor) Process(ctx context.Context, in, out TProtocol) (bool, TException) {
	name, typeId, seqid, err := in.ReadMessageBegin(ctx)
	if err != nil {
		return false, NewTProtocolException(err)
	}
	if typeId != CALL && typeId != ONEWAY {
		return false, NewTProtocolException(fmt.Errorf("Unexpected message type %v", typeId))
	}
	//extract the service name
	v := strings.SplitN(name, MULTIPLEXED_SEPARATOR, 2)
	if len(v) != 2 {
		if t.DefaultProcessor != nil {
			smb := NewStoredMessageProtocol(in, name, typeId, seqid)
			return t.DefaultProcessor.Process(ctx, smb, out)
		}
		return false, NewTProtocolException(fmt.Errorf(
			"Service name not found in message name: %s.  Did you forget to use a TMultiplexProtocol in your client?",
			name,
		))
	}
	actualProcessor, ok := t.serviceProcessorMap[v[0]]
	if !ok {
		return false, NewTProtocolException(fmt.Errorf(
			"Service name not found: %s.  Did you forget to call registerProcessor()?",
			v[0],
		))
	}
	smb := NewStoredMessageProtocol(in, v[1], typeId, seqid)
	return actualProcessor.Process(ctx, smb, out)
}

//Protocol that use stored message for ReadMessageBegin
type storedMessageProtocol struct {
	TProtocol
	name   string
	typeId TMessageType
	seqid  int32
}

func NewStoredMessageProtocol(protocol TProtocol, name string, typeId TMessageType, seqid int32) *storedMessageProtocol {
	return &storedMessageProtocol{protocol, name, typeId, seqid}
}

func (s *storedMessageProtocol) ReadMessageBegin(ctx context.Context) (name string, typeId TMessageType, seqid int32, err error) {
	return s.name, s.typeId, s.seqid, nil
}
