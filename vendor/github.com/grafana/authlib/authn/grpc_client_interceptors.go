package authn

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// GrpcClientInterceptor is a gRPC client interceptor that adds an access token to the outgoing context metadata.
type GrpcClientInterceptor struct {
	tc     TokenExchanger
	tracer trace.Tracer

	namespace        string
	aud              []string
	idTokenExtractor func(context.Context) (string, error)
}

type GrpcClientInterceptorOption func(*GrpcClientInterceptor)

// WithClientInterceptorTracer sets the tracer for the gRPC client interceptor.
func WithClientInterceptorTracer(tracer trace.Tracer) GrpcClientInterceptorOption {
	return func(i *GrpcClientInterceptor) {
		i.tracer = tracer
	}
}

// WithClientInterceptorIDTokenExtractor is an option to set the ID token extractor for the gRPC client interceptor.
// Warning: The id_token will be considered optional if the extractor returns an empty string.
// Returning an error will stop the interceptor.
func WithClientInterceptorIDTokenExtractor(fn func(context.Context) (string, error)) GrpcClientInterceptorOption {
	return func(i *GrpcClientInterceptor) {
		i.idTokenExtractor = fn
	}
}

// WithClientInterceptorNamespace sets the namespace used in signed access token.
func WithClientInterceptorNamespace(namespace string) GrpcClientInterceptorOption {
	return func(i *GrpcClientInterceptor) {
		i.namespace = namespace
	}
}

// WithClientInterceptorAudience sets audience used in signed access token.
func WithClientInterceptorAudience(aud []string) GrpcClientInterceptorOption {
	return func(i *GrpcClientInterceptor) {
		i.aud = aud
	}
}

func NewGrpcClientInterceptor(tc TokenExchanger, opts ...GrpcClientInterceptorOption) *GrpcClientInterceptor {
	i := &GrpcClientInterceptor{tc: tc}

	for _, opt := range opts {
		opt(i)
	}

	if i.tracer == nil {
		i.tracer = noop.Tracer{}
	}

	return i
}

func (i *GrpcClientInterceptor) UnaryClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := i.wrapContext(ctx)
	if err != nil {
		return err
	}

	return invoker(ctx, method, req, reply, cc, opts...)
}

func (i *GrpcClientInterceptor) StreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := i.wrapContext(ctx)
	if err != nil {
		return nil, err
	}

	return streamer(ctx, desc, cc, method, opts...)
}

func (i *GrpcClientInterceptor) wrapContext(ctx context.Context) (context.Context, error) {
	spanCtx, span := i.tracer.Start(ctx, "GrpcClientInterceptor.wrapContext")
	defer span.End()

	// Keep any existing values
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		md = make(metadata.MD)
	}

	token, err := i.tc.Exchange(spanCtx, TokenExchangeRequest{
		Namespace: i.namespace,
		Audiences: i.aud,
	})
	if err != nil {
		span.RecordError(err)
		return ctx, err
	}

	span.SetAttributes(attribute.Bool("with_accesstoken", true))
	md.Set(metadataKeyAccessToken, token.Token)

	if i.idTokenExtractor != nil {
		idToken, err := i.idTokenExtractor(spanCtx)
		if err != nil {
			span.RecordError(err)
			return ctx, err
		}
		if idToken != "" {
			span.SetAttributes(attribute.Bool("with_idtoken", true))
			md.Set(metadataKeyIDTokenMetadata, idToken)
		}
	}

	return metadata.NewOutgoingContext(ctx, md), nil
}
