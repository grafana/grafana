package plugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type CoreServer interface {
	pluginv2.CoreServer
}

// CoreGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type CoreGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	CoreServer CoreServer
}

func (p *CoreGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterCoreServer(s, &coreGRPCServer{
		server: p.CoreServer,
	})
	return nil
}

func (p *CoreGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &coreGRPCClient{client: pluginv2.NewCoreClient(c)}, nil
}

type coreGRPCServer struct {
	server CoreServer
}

func (s *coreGRPCServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return s.server.DataQuery(ctx, req)
}

func (s *coreGRPCServer) CallResource(ctx context.Context, req *pluginv2.CallResource_Request) (*pluginv2.CallResource_Response, error) {
	return s.server.CallResource(ctx, req)
}

type coreGRPCClient struct {
	client pluginv2.CoreClient
}

func (m *coreGRPCClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.client.DataQuery(ctx, req)
}

func (m *coreGRPCClient) CallResource(ctx context.Context, req *pluginv2.CallResource_Request) (*pluginv2.CallResource_Response, error) {
	return m.client.CallResource(ctx, req)
}

var _ CoreServer = &coreGRPCServer{}
var _ CoreServer = &coreGRPCClient{}
