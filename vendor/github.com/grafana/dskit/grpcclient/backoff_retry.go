package grpcclient

import (
	"context"
	"errors"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/dskit/backoff"
)

// NewRateLimitRetrier creates a UnaryClientInterceptor which retries with backoff
// the calls from invoker when the executed RPC is rate limited.
func NewRateLimitRetrier(cfg backoff.Config) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		backoff := backoff.New(ctx, cfg)
		var err error
		for backoff.Ongoing() {
			err = invoker(ctx, method, req, reply, cc, opts...)
			if err == nil {
				return nil
			}

			// Only ResourceExhausted statuses are handled as signals of being rate limited,
			// following the implementation of package's RateLimiter interceptor.
			// All other errors are propogated as-is upstream.
			if status.Code(err) != codes.ResourceExhausted {
				return err
			}

			backoff.Wait()
		}
		return errors.Join(err, backoff.Err())
	}
}
