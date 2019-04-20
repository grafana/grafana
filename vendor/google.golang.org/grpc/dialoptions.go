/*
 *
 * Copyright 2018 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package grpc

import (
	"fmt"
	"net"
	"time"

	"golang.org/x/net/context"
	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/internal"
	"google.golang.org/grpc/internal/backoff"
	"google.golang.org/grpc/internal/envconfig"
	"google.golang.org/grpc/internal/transport"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/stats"
)

// dialOptions configure a Dial call. dialOptions are set by the DialOption
// values passed to Dial.
type dialOptions struct {
	unaryInt    UnaryClientInterceptor
	streamInt   StreamClientInterceptor
	cp          Compressor
	dc          Decompressor
	bs          backoff.Strategy
	block       bool
	insecure    bool
	timeout     time.Duration
	scChan      <-chan ServiceConfig
	authority   string
	copts       transport.ConnectOptions
	callOptions []CallOption
	// This is used by v1 balancer dial option WithBalancer to support v1
	// balancer, and also by WithBalancerName dial option.
	balancerBuilder balancer.Builder
	// This is to support grpclb.
	resolverBuilder      resolver.Builder
	waitForHandshake     bool
	channelzParentID     int64
	disableServiceConfig bool
	disableRetry         bool
}

// DialOption configures how we set up the connection.
type DialOption interface {
	apply(*dialOptions)
}

// EmptyDialOption does not alter the dial configuration. It can be embedded in
// another structure to build custom dial options.
//
// This API is EXPERIMENTAL.
type EmptyDialOption struct{}

func (EmptyDialOption) apply(*dialOptions) {}

// funcDialOption wraps a function that modifies dialOptions into an
// implementation of the DialOption interface.
type funcDialOption struct {
	f func(*dialOptions)
}

func (fdo *funcDialOption) apply(do *dialOptions) {
	fdo.f(do)
}

func newFuncDialOption(f func(*dialOptions)) *funcDialOption {
	return &funcDialOption{
		f: f,
	}
}

// WithWaitForHandshake blocks until the initial settings frame is received from
// the server before assigning RPCs to the connection. Experimental API.
func WithWaitForHandshake() DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.waitForHandshake = true
	})
}

// WithWriteBufferSize determines how much data can be batched before doing a
// write on the wire. The corresponding memory allocation for this buffer will
// be twice the size to keep syscalls low. The default value for this buffer is
// 32KB.
//
// Zero will disable the write buffer such that each write will be on underlying
// connection. Note: A Send call may not directly translate to a write.
func WithWriteBufferSize(s int) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.WriteBufferSize = s
	})
}

// WithReadBufferSize lets you set the size of read buffer, this determines how
// much data can be read at most for each read syscall.
//
// The default value for this buffer is 32KB. Zero will disable read buffer for
// a connection so data framer can access the underlying conn directly.
func WithReadBufferSize(s int) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.ReadBufferSize = s
	})
}

// WithInitialWindowSize returns a DialOption which sets the value for initial
// window size on a stream. The lower bound for window size is 64K and any value
// smaller than that will be ignored.
func WithInitialWindowSize(s int32) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.InitialWindowSize = s
	})
}

// WithInitialConnWindowSize returns a DialOption which sets the value for
// initial window size on a connection. The lower bound for window size is 64K
// and any value smaller than that will be ignored.
func WithInitialConnWindowSize(s int32) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.InitialConnWindowSize = s
	})
}

// WithMaxMsgSize returns a DialOption which sets the maximum message size the
// client can receive.
//
// Deprecated: use WithDefaultCallOptions(MaxCallRecvMsgSize(s)) instead.
func WithMaxMsgSize(s int) DialOption {
	return WithDefaultCallOptions(MaxCallRecvMsgSize(s))
}

// WithDefaultCallOptions returns a DialOption which sets the default
// CallOptions for calls over the connection.
func WithDefaultCallOptions(cos ...CallOption) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.callOptions = append(o.callOptions, cos...)
	})
}

// WithCodec returns a DialOption which sets a codec for message marshaling and
// unmarshaling.
//
// Deprecated: use WithDefaultCallOptions(CallCustomCodec(c)) instead.
func WithCodec(c Codec) DialOption {
	return WithDefaultCallOptions(CallCustomCodec(c))
}

// WithCompressor returns a DialOption which sets a Compressor to use for
// message compression. It has lower priority than the compressor set by the
// UseCompressor CallOption.
//
// Deprecated: use UseCompressor instead.
func WithCompressor(cp Compressor) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.cp = cp
	})
}

// WithDecompressor returns a DialOption which sets a Decompressor to use for
// incoming message decompression.  If incoming response messages are encoded
// using the decompressor's Type(), it will be used.  Otherwise, the message
// encoding will be used to look up the compressor registered via
// encoding.RegisterCompressor, which will then be used to decompress the
// message.  If no compressor is registered for the encoding, an Unimplemented
// status error will be returned.
//
// Deprecated: use encoding.RegisterCompressor instead.
func WithDecompressor(dc Decompressor) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.dc = dc
	})
}

// WithBalancer returns a DialOption which sets a load balancer with the v1 API.
// Name resolver will be ignored if this DialOption is specified.
//
// Deprecated: use the new balancer APIs in balancer package and
// WithBalancerName.
func WithBalancer(b Balancer) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.balancerBuilder = &balancerWrapperBuilder{
			b: b,
		}
	})
}

// WithBalancerName sets the balancer that the ClientConn will be initialized
// with. Balancer registered with balancerName will be used. This function
// panics if no balancer was registered by balancerName.
//
// The balancer cannot be overridden by balancer option specified by service
// config.
//
// This is an EXPERIMENTAL API.
func WithBalancerName(balancerName string) DialOption {
	builder := balancer.Get(balancerName)
	if builder == nil {
		panic(fmt.Sprintf("grpc.WithBalancerName: no balancer is registered for name %v", balancerName))
	}
	return newFuncDialOption(func(o *dialOptions) {
		o.balancerBuilder = builder
	})
}

// withResolverBuilder is only for grpclb.
func withResolverBuilder(b resolver.Builder) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.resolverBuilder = b
	})
}

// WithServiceConfig returns a DialOption which has a channel to read the
// service configuration.
//
// Deprecated: service config should be received through name resolver, as
// specified here.
// https://github.com/grpc/grpc/blob/master/doc/service_config.md
func WithServiceConfig(c <-chan ServiceConfig) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.scChan = c
	})
}

// WithBackoffMaxDelay configures the dialer to use the provided maximum delay
// when backing off after failed connection attempts.
func WithBackoffMaxDelay(md time.Duration) DialOption {
	return WithBackoffConfig(BackoffConfig{MaxDelay: md})
}

// WithBackoffConfig configures the dialer to use the provided backoff
// parameters after connection failures.
//
// Use WithBackoffMaxDelay until more parameters on BackoffConfig are opened up
// for use.
func WithBackoffConfig(b BackoffConfig) DialOption {
	return withBackoff(backoff.Exponential{
		MaxDelay: b.MaxDelay,
	})
}

// withBackoff sets the backoff strategy used for connectRetryNum after a failed
// connection attempt.
//
// This can be exported if arbitrary backoff strategies are allowed by gRPC.
func withBackoff(bs backoff.Strategy) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.bs = bs
	})
}

// WithBlock returns a DialOption which makes caller of Dial blocks until the
// underlying connection is up. Without this, Dial returns immediately and
// connecting the server happens in background.
func WithBlock() DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.block = true
	})
}

// WithInsecure returns a DialOption which disables transport security for this
// ClientConn. Note that transport security is required unless WithInsecure is
// set.
func WithInsecure() DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.insecure = true
	})
}

// WithTransportCredentials returns a DialOption which configures a connection
// level security credentials (e.g., TLS/SSL).
func WithTransportCredentials(creds credentials.TransportCredentials) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.TransportCredentials = creds
	})
}

// WithPerRPCCredentials returns a DialOption which sets credentials and places
// auth state on each outbound RPC.
func WithPerRPCCredentials(creds credentials.PerRPCCredentials) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.PerRPCCredentials = append(o.copts.PerRPCCredentials, creds)
	})
}

// WithTimeout returns a DialOption that configures a timeout for dialing a
// ClientConn initially. This is valid if and only if WithBlock() is present.
//
// Deprecated: use DialContext and context.WithTimeout instead.
func WithTimeout(d time.Duration) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.timeout = d
	})
}

func withContextDialer(f func(context.Context, string) (net.Conn, error)) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.Dialer = f
	})
}

func init() {
	internal.WithContextDialer = withContextDialer
	internal.WithResolverBuilder = withResolverBuilder
}

// WithDialer returns a DialOption that specifies a function to use for dialing
// network addresses. If FailOnNonTempDialError() is set to true, and an error
// is returned by f, gRPC checks the error's Temporary() method to decide if it
// should try to reconnect to the network address.
func WithDialer(f func(string, time.Duration) (net.Conn, error)) DialOption {
	return withContextDialer(
		func(ctx context.Context, addr string) (net.Conn, error) {
			if deadline, ok := ctx.Deadline(); ok {
				return f(addr, deadline.Sub(time.Now()))
			}
			return f(addr, 0)
		})
}

// WithStatsHandler returns a DialOption that specifies the stats handler for
// all the RPCs and underlying network connections in this ClientConn.
func WithStatsHandler(h stats.Handler) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.StatsHandler = h
	})
}

// FailOnNonTempDialError returns a DialOption that specifies if gRPC fails on
// non-temporary dial errors. If f is true, and dialer returns a non-temporary
// error, gRPC will fail the connection to the network address and won't try to
// reconnect. The default value of FailOnNonTempDialError is false.
//
// This is an EXPERIMENTAL API.
func FailOnNonTempDialError(f bool) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.FailOnNonTempDialError = f
	})
}

// WithUserAgent returns a DialOption that specifies a user agent string for all
// the RPCs.
func WithUserAgent(s string) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.UserAgent = s
	})
}

// WithKeepaliveParams returns a DialOption that specifies keepalive parameters
// for the client transport.
func WithKeepaliveParams(kp keepalive.ClientParameters) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.KeepaliveParams = kp
	})
}

// WithUnaryInterceptor returns a DialOption that specifies the interceptor for
// unary RPCs.
func WithUnaryInterceptor(f UnaryClientInterceptor) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.unaryInt = f
	})
}

// WithStreamInterceptor returns a DialOption that specifies the interceptor for
// streaming RPCs.
func WithStreamInterceptor(f StreamClientInterceptor) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.streamInt = f
	})
}

// WithAuthority returns a DialOption that specifies the value to be used as the
// :authority pseudo-header. This value only works with WithInsecure and has no
// effect if TransportCredentials are present.
func WithAuthority(a string) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.authority = a
	})
}

// WithChannelzParentID returns a DialOption that specifies the channelz ID of
// current ClientConn's parent. This function is used in nested channel creation
// (e.g. grpclb dial).
func WithChannelzParentID(id int64) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.channelzParentID = id
	})
}

// WithDisableServiceConfig returns a DialOption that causes grpc to ignore any
// service config provided by the resolver and provides a hint to the resolver
// to not fetch service configs.
func WithDisableServiceConfig() DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.disableServiceConfig = true
	})
}

// WithDisableRetry returns a DialOption that disables retries, even if the
// service config enables them.  This does not impact transparent retries, which
// will happen automatically if no data is written to the wire or if the RPC is
// unprocessed by the remote server.
//
// Retry support is currently disabled by default, but will be enabled by
// default in the future.  Until then, it may be enabled by setting the
// environment variable "GRPC_GO_RETRY" to "on".
//
// This API is EXPERIMENTAL.
func WithDisableRetry() DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.disableRetry = true
	})
}

// WithMaxHeaderListSize returns a DialOption that specifies the maximum
// (uncompressed) size of header list that the client is prepared to accept.
func WithMaxHeaderListSize(s uint32) DialOption {
	return newFuncDialOption(func(o *dialOptions) {
		o.copts.MaxHeaderListSize = &s
	})
}

func defaultDialOptions() dialOptions {
	return dialOptions{
		disableRetry: !envconfig.Retry,
		copts: transport.ConnectOptions{
			WriteBufferSize: defaultWriteBufSize,
			ReadBufferSize:  defaultReadBufSize,
		},
	}
}
