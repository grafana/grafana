package plugin

import (
	"context"

	"github.com/hashicorp/go-plugin/internal/plugin"
)

// GRPCControllerServer handles shutdown calls to terminate the server when the
// plugin client is closed.
type grpcControllerServer struct {
	server *GRPCServer
}

// Shutdown stops the grpc server. It first will attempt a graceful stop, then a
// full stop on the server.
func (s *grpcControllerServer) Shutdown(ctx context.Context, _ *plugin.Empty) (*plugin.Empty, error) {
	resp := &plugin.Empty{}

	// TODO: figure out why GracefullStop doesn't work.
	s.server.Stop()
	return resp, nil
}
