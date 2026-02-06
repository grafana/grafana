// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package grpctransport

import (
	"context"
	"fmt"
	"sync/atomic"

	"google.golang.org/grpc"
)

// GRPCClientConnPool is an interface that satisfies
// [google.golang.org/grpc.ClientConnInterface] and has some utility functions
// that are needed for connection lifecycle when using in a client library. It
// may be a pool or a single connection. This interface is not intended to, and
// can't be, implemented by others.
type GRPCClientConnPool interface {
	// Connection returns a [google.golang.org/grpc.ClientConn] from the pool.
	//
	// ClientConn aren't returned to the pool and should not be closed directly.
	Connection() *grpc.ClientConn

	// Len returns the number of connections in the pool. It will always return
	// the same value.
	Len() int

	// Close closes every ClientConn in the pool. The error returned by Close
	// may be a single error or multiple errors.
	Close() error

	grpc.ClientConnInterface

	// private ensure others outside this package can't implement this type
	private()
}

// singleConnPool is a special case for a single connection.
type singleConnPool struct {
	*grpc.ClientConn
}

func (p *singleConnPool) Connection() *grpc.ClientConn { return p.ClientConn }
func (p *singleConnPool) Len() int                     { return 1 }
func (p *singleConnPool) private()                     {}

type roundRobinConnPool struct {
	conns []*grpc.ClientConn

	idx uint32 // access via sync/atomic
}

func (p *roundRobinConnPool) Len() int {
	return len(p.conns)
}

func (p *roundRobinConnPool) Connection() *grpc.ClientConn {
	i := atomic.AddUint32(&p.idx, 1)
	return p.conns[i%uint32(len(p.conns))]
}

func (p *roundRobinConnPool) Close() error {
	var errs multiError
	for _, conn := range p.conns {
		if err := conn.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) == 0 {
		return nil
	}
	return errs
}

func (p *roundRobinConnPool) Invoke(ctx context.Context, method string, args interface{}, reply interface{}, opts ...grpc.CallOption) error {
	return p.Connection().Invoke(ctx, method, args, reply, opts...)
}

func (p *roundRobinConnPool) NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	return p.Connection().NewStream(ctx, desc, method, opts...)
}

func (p *roundRobinConnPool) private() {}

// multiError represents errors from multiple conns in the group.
type multiError []error

func (m multiError) Error() string {
	s, n := "", 0
	for _, e := range m {
		if e != nil {
			if n == 0 {
				s = e.Error()
			}
			n++
		}
	}
	switch n {
	case 0:
		return "(0 errors)"
	case 1:
		return s
	case 2:
		return s + " (and 1 other error)"
	}
	return fmt.Sprintf("%s (and %d other errors)", s, n-1)
}
