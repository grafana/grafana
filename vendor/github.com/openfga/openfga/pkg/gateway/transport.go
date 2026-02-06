package gateway

import (
	"context"

	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/openfga/openfga/pkg/logger"
)

// Transport is the interface to work with the transport layer.
type Transport interface {
	// SetHeader sets a response header with a key and a value.
	// It should not be called after a response has been sent.
	SetHeader(ctx context.Context, key, value string)
}

// NoopTransport defines a no-op transport.
type NoopTransport struct {
}

var _ Transport = (*NoopTransport)(nil)

func NewNoopTransport() *NoopTransport {
	return &NoopTransport{}
}

func (n *NoopTransport) SetHeader(_ context.Context, key, value string) {

}

// RPCTransport defines a transport for gRPC.
type RPCTransport struct {
	logger logger.Logger
}

var _ Transport = (*RPCTransport)(nil)

// NewRPCTransport returns a transport for gRPC.
func NewRPCTransport(l logger.Logger) *RPCTransport {
	return &RPCTransport{logger: l}
}

// SetHeader tries to set a header. If an error occurred, it logs an error.
func (g *RPCTransport) SetHeader(ctx context.Context, key, value string) {
	if err := grpc.SetHeader(ctx, metadata.Pairs(key, value)); err != nil {
		g.logger.ErrorWithContext(
			ctx,
			"failed to set grpc header",
			zap.Error(err),
			zap.String("header", key),
		)
	}
}
