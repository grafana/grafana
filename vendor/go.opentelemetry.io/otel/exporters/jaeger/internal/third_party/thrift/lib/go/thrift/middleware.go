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

import "context"

// ProcessorMiddleware is a function that can be passed to WrapProcessor to wrap the
// TProcessorFunctions for that TProcessor.
//
// Middlewares are passed in the name of the function as set in the processor
// map of the TProcessor.
type ProcessorMiddleware func(name string, next TProcessorFunction) TProcessorFunction

// WrapProcessor takes an existing TProcessor and wraps each of its inner
// TProcessorFunctions with the middlewares passed in and returns it.
//
// Middlewares will be called in the order that they are defined:
//
//		1. Middlewares[0]
//		2. Middlewares[1]
//		...
//		N. Middlewares[n]
func WrapProcessor(processor TProcessor, middlewares ...ProcessorMiddleware) TProcessor {
	for name, processorFunc := range processor.ProcessorMap() {
		wrapped := processorFunc
		// Add middlewares in reverse so the first in the list is the outermost.
		for i := len(middlewares) - 1; i >= 0; i-- {
			wrapped = middlewares[i](name, wrapped)
		}
		processor.AddToProcessorMap(name, wrapped)
	}
	return processor
}

// WrappedTProcessorFunction is a convenience struct that implements the
// TProcessorFunction interface that can be used when implementing custom
// Middleware.
type WrappedTProcessorFunction struct {
	// Wrapped is called by WrappedTProcessorFunction.Process and should be a
	// "wrapped" call to a base TProcessorFunc.Process call.
	Wrapped func(ctx context.Context, seqId int32, in, out TProtocol) (bool, TException)
}

// Process implements the TProcessorFunction interface using p.Wrapped.
func (p WrappedTProcessorFunction) Process(ctx context.Context, seqID int32, in, out TProtocol) (bool, TException) {
	return p.Wrapped(ctx, seqID, in, out)
}

// verify that WrappedTProcessorFunction implements TProcessorFunction
var (
	_ TProcessorFunction = WrappedTProcessorFunction{}
	_ TProcessorFunction = (*WrappedTProcessorFunction)(nil)
)

// ClientMiddleware can be passed to WrapClient in order to wrap TClient calls
// with custom middleware.
type ClientMiddleware func(TClient) TClient

// WrappedTClient is a convenience struct that implements the TClient interface
// using inner Wrapped function.
//
// This is provided to aid in developing ClientMiddleware.
type WrappedTClient struct {
	Wrapped func(ctx context.Context, method string, args, result TStruct) (ResponseMeta, error)
}

// Call implements the TClient interface by calling and returning c.Wrapped.
func (c WrappedTClient) Call(ctx context.Context, method string, args, result TStruct) (ResponseMeta, error) {
	return c.Wrapped(ctx, method, args, result)
}

// verify that WrappedTClient implements TClient
var (
	_ TClient = WrappedTClient{}
	_ TClient = (*WrappedTClient)(nil)
)

// WrapClient wraps the given TClient in the given middlewares.
//
// Middlewares will be called in the order that they are defined:
//
//		1. Middlewares[0]
//		2. Middlewares[1]
//		...
//		N. Middlewares[n]
func WrapClient(client TClient, middlewares ...ClientMiddleware) TClient {
	// Add middlewares in reverse so the first in the list is the outermost.
	for i := len(middlewares) - 1; i >= 0; i-- {
		client = middlewares[i](client)
	}
	return client
}
