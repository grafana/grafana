package grpcplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// ResourceServer is the server API for the Resource service.
type ResourceServer interface {
	pluginv2.ResourceServer
}

// ResourceClient is the client API for the Resource service.
type ResourceClient interface {
	pluginv2.ResourceClient
}

// ResourceGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type ResourceGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	ResourceServer ResourceServer
}

// GRPCServer registers p as a resource gRPC server.
func (p *ResourceGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterResourceServer(s, &resourceGRPCServer{
		server: p.ResourceServer,
	})
	return nil
}

// GRPCClient returns c as a resource gRPC client.
func (p *ResourceGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &resourceGRPCClient{client: pluginv2.NewResourceClient(c)}, nil
}

type resourceGRPCServer struct {
	server ResourceServer
}

// CallResource calls a resource.
func (s *resourceGRPCServer) CallResource(req *pluginv2.CallResourceRequest, srv pluginv2.Resource_CallResourceServer) error {
	return s.server.CallResource(req, srv)
}

type resourceGRPCClient struct {
	client pluginv2.ResourceClient
}

// CallResource calls a resource.
func (m *resourceGRPCClient) CallResource(ctx context.Context, req *pluginv2.CallResourceRequest, opts ...grpc.CallOption) (pluginv2.Resource_CallResourceClient, error) {
	return m.client.CallResource(ctx, req, opts...)
}

var _ ResourceServer = &resourceGRPCServer{}
var _ ResourceClient = &resourceGRPCClient{}
