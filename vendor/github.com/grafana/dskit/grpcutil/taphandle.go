package grpcutil

import (
	"context"

	"google.golang.org/grpc/tap"
)

// ComposeTapHandles allows multiple tap handles to be composed, since only one may be specified by gRPC server.
func ComposeTapHandles(handles []tap.ServerInHandle) tap.ServerInHandle {
	if len(handles) == 1 {
		return handles[0]
	}

	return func(ctx context.Context, info *tap.Info) (context.Context, error) {
		var err error
		for _, h := range handles {
			ctx, err = h(ctx, info)
			if err != nil {
				return ctx, err
			}
		}
		return ctx, nil
	}
}
