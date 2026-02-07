// Copyright 2017 Michal Witkowski. All Rights Reserved.
// See LICENSE for licensing terms.

package grpc_ctxtags

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/peer"

	"github.com/grpc-ecosystem/go-grpc-middleware"
)

// UnaryServerInterceptor returns a new unary server interceptors that sets the values for request tags.
func UnaryServerInterceptor(opts ...Option) grpc.UnaryServerInterceptor {
	o := evaluateOptions(opts)
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		newCtx := newTagsForCtx(ctx)
		if o.requestFieldsFunc != nil {
			setRequestFieldTags(newCtx, o.requestFieldsFunc, info.FullMethod, req)
		}
		return handler(newCtx, req)
	}
}

// StreamServerInterceptor returns a new streaming server interceptor that sets the values for request tags.
func StreamServerInterceptor(opts ...Option) grpc.StreamServerInterceptor {
	o := evaluateOptions(opts)
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		newCtx := newTagsForCtx(stream.Context())
		if o.requestFieldsFunc == nil {
			// Short-circuit, don't do the expensive bit of allocating a wrappedStream.
			wrappedStream := grpc_middleware.WrapServerStream(stream)
			wrappedStream.WrappedContext = newCtx
			return handler(srv, wrappedStream)
		}
		wrapped := &wrappedStream{stream, info, o, newCtx, true}
		err := handler(srv, wrapped)
		return err
	}
}

// wrappedStream is a thin wrapper around grpc.ServerStream that allows modifying context and extracts log fields from the initial message.
type wrappedStream struct {
	grpc.ServerStream
	info *grpc.StreamServerInfo
	opts *options
	// WrappedContext is the wrapper's own Context. You can assign it.
	WrappedContext context.Context
	initial        bool
}

// Context returns the wrapper's WrappedContext, overwriting the nested grpc.ServerStream.Context()
func (w *wrappedStream) Context() context.Context {
	return w.WrappedContext
}

func (w *wrappedStream) RecvMsg(m interface{}) error {
	err := w.ServerStream.RecvMsg(m)
	// We only do log fields extraction on the single-request of a server-side stream.
	if !w.info.IsClientStream || w.opts.requestFieldsFromInitial && w.initial {
		w.initial = false

		setRequestFieldTags(w.Context(), w.opts.requestFieldsFunc, w.info.FullMethod, m)
	}
	return err
}

func newTagsForCtx(ctx context.Context) context.Context {
	t := NewTags()
	if peer, ok := peer.FromContext(ctx); ok {
		t.Set("peer.address", peer.Addr.String())
	}
	return SetInContext(ctx, t)
}

func setRequestFieldTags(ctx context.Context, f RequestFieldExtractorFunc, fullMethodName string, req interface{}) {
	if valMap := f(fullMethodName, req); valMap != nil {
		t := Extract(ctx)
		for k, v := range valMap {
			t.Set("grpc.request."+k, v)
		}
	}
}
