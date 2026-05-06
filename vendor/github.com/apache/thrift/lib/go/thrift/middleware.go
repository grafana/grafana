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
)

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

// ExtractIDLExceptionClientMiddleware is a ClientMiddleware implementation that
// extracts exceptions defined in thrift IDL into the error return of
// TClient.Call. It uses ExtractExceptionFromResult under the hood.
//
// By default if a client call gets an exception defined in the thrift IDL, for
// example:
//
//     service MyService {
//       FooResponse foo(1: FooRequest request) throws (
//         1: Exception1 error1,
//         2: Exception2 error2,
//       )
//     }
//
// Exception1 or Exception2 will not be in the err return of TClient.Call,
// but in the result TStruct instead, and there's no easy access to them.
// If you have a ClientMiddleware that would need to access them,
// you can add this middleware into your client middleware chain,
// *after* your other middlewares need them,
// then your other middlewares will have access to those exceptions from the err
// return.
//
// Alternatively you can also just use ExtractExceptionFromResult in your client
// middleware directly to access those exceptions.
func ExtractIDLExceptionClientMiddleware(next TClient) TClient {
	return WrappedTClient{
		Wrapped: func(ctx context.Context, method string, args, result TStruct) (_ ResponseMeta, err error) {
			defer func() {
				if err == nil {
					err = ExtractExceptionFromResult(result)
				}
			}()
			return next.Call(ctx, method, args, result)
		},
	}
}
