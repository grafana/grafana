package renderer

import (
	"context"

	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type RendererPlugin interface {
	Render(ctx context.Context, req *RenderRequest) (*RenderResponse, error)
}

type RendererPluginImpl struct {
	plugin.NetRPCUnsupportedPlugin
	Plugin RendererPlugin
}

func (p *RendererPluginImpl) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	RegisterRendererServer(s, &GRPCServer{p.Plugin})
	return nil
}

func (p *RendererPluginImpl) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &GRPCClient{NewRendererClient(c)}, nil
}

type GRPCClient struct {
	RendererClient
}

func (m *GRPCClient) Render(ctx context.Context, req *RenderRequest) (*RenderResponse, error) {
	return m.RendererClient.Render(ctx, req)
}

type GRPCServer struct {
	RendererPlugin
}

func (m *GRPCServer) Render(ctx context.Context, req *RenderRequest) (*RenderResponse, error) {
	return m.RendererPlugin.Render(ctx, req)
}
