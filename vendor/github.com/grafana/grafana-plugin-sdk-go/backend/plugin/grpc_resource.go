package plugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type ResourceServer interface {
	pluginv2.ResourceServer
}

type ResourceClient interface {
	pluginv2.ResourceClient
}

// ResourceGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type ResourceGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	ResourceServer ResourceServer
}

func (p *ResourceGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterResourceServer(s, &resourceGRPCServer{
		server: p.ResourceServer,
	})
	return nil
}

func (p *ResourceGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &resourceGRPCClient{client: pluginv2.NewResourceClient(c)}, nil
}

type resourceGRPCServer struct {
	server ResourceServer
}

func (s *resourceGRPCServer) CallResource(req *pluginv2.CallResourceRequest, srv pluginv2.Resource_CallResourceServer) error {
	return s.server.CallResource(req, srv)
}

type resourceGRPCClient struct {
	client pluginv2.ResourceClient
}

func (m *resourceGRPCClient) CallResource(ctx context.Context, req *pluginv2.CallResourceRequest, opts ...grpc.CallOption) (pluginv2.Resource_CallResourceClient, error) {
	return m.client.CallResource(ctx, req, opts...)
}

var _ ResourceServer = &resourceGRPCServer{}
var _ ResourceClient = &resourceGRPCClient{}
