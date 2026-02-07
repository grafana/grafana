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
	"sync"
)

type TSerializer struct {
	Transport *TMemoryBuffer
	Protocol  TProtocol
}

type TStruct interface {
	Write(ctx context.Context, p TProtocol) error
	Read(ctx context.Context, p TProtocol) error
}

func NewTSerializer() *TSerializer {
	transport := NewTMemoryBufferLen(1024)
	protocol := NewTBinaryProtocolTransport(transport)

	return &TSerializer{
		Transport: transport,
		Protocol:  protocol,
	}
}

func (t *TSerializer) WriteString(ctx context.Context, msg TStruct) (s string, err error) {
	t.Transport.Reset()

	if err = msg.Write(ctx, t.Protocol); err != nil {
		return
	}

	if err = t.Protocol.Flush(ctx); err != nil {
		return
	}
	if err = t.Transport.Flush(ctx); err != nil {
		return
	}

	return t.Transport.String(), nil
}

func (t *TSerializer) Write(ctx context.Context, msg TStruct) (b []byte, err error) {
	t.Transport.Reset()

	if err = msg.Write(ctx, t.Protocol); err != nil {
		return
	}

	if err = t.Protocol.Flush(ctx); err != nil {
		return
	}

	if err = t.Transport.Flush(ctx); err != nil {
		return
	}

	b = append(b, t.Transport.Bytes()...)
	return
}

// TSerializerPool is the thread-safe version of TSerializer, it uses resource
// pool of TSerializer under the hood.
//
// It must be initialized with either NewTSerializerPool or
// NewTSerializerPoolSizeFactory.
type TSerializerPool struct {
	pool sync.Pool
}

// NewTSerializerPool creates a new TSerializerPool.
//
// NewTSerializer can be used as the arg here.
func NewTSerializerPool(f func() *TSerializer) *TSerializerPool {
	return &TSerializerPool{
		pool: sync.Pool{
			New: func() interface{} {
				return f()
			},
		},
	}
}

// NewTSerializerPoolSizeFactory creates a new TSerializerPool with the given
// size and protocol factory.
//
// Note that the size is not the limit. The TMemoryBuffer underneath can grow
// larger than that. It just dictates the initial size.
func NewTSerializerPoolSizeFactory(size int, factory TProtocolFactory) *TSerializerPool {
	return &TSerializerPool{
		pool: sync.Pool{
			New: func() interface{} {
				transport := NewTMemoryBufferLen(size)
				protocol := factory.GetProtocol(transport)

				return &TSerializer{
					Transport: transport,
					Protocol:  protocol,
				}
			},
		},
	}
}

func (t *TSerializerPool) WriteString(ctx context.Context, msg TStruct) (string, error) {
	s := t.pool.Get().(*TSerializer)
	defer t.pool.Put(s)
	return s.WriteString(ctx, msg)
}

func (t *TSerializerPool) Write(ctx context.Context, msg TStruct) ([]byte, error) {
	s := t.pool.Get().(*TSerializer)
	defer t.pool.Put(s)
	return s.Write(ctx, msg)
}
