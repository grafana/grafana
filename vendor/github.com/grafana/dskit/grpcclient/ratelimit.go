package grpcclient

import (
	"context"

	"golang.org/x/time/rate"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// NewRateLimiter creates a UnaryClientInterceptor for client side rate limiting.
func NewRateLimiter(cfg *Config) grpc.UnaryClientInterceptor {
	burst := cfg.RateLimitBurst
	if burst == 0 {
		burst = int(cfg.RateLimit)
	}
	limiter := rate.NewLimiter(rate.Limit(cfg.RateLimit), burst)
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		err := limiter.Wait(ctx)
		if err != nil {
			return status.Error(codes.ResourceExhausted, err.Error())
		}
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}
