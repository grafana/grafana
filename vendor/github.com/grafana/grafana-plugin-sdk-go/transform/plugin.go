package transform

import (
	"context"

	ptrans "github.com/grafana/grafana-plugin-sdk-go/genproto/transform"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// TransformPluginImpl implements the plugin interface from github.com/hashicorp/go-plugin.
type TransformPluginImpl struct {
	plugin.NetRPCUnsupportedPlugin

	Impl transformPluginWrapper
}

// GRPCServer implements the server for a TransformPlugin
func (p *TransformPluginImpl) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	ptrans.RegisterTransformPluginServer(s, &grpcServer{
		Impl:   p.Impl,
		broker: broker,
	})
	return nil
}

// GRPCClient implements the client for a TransformPlugin
func (p *TransformPluginImpl) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &GRPCClient{client: ptrans.NewTransformPluginClient(c), broker: broker}, nil
}
