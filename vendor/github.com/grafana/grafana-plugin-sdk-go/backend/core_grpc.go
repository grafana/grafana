package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// CoreGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type CoreGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	server pluginv2.CoreServer
}

func (p *CoreGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterCoreServer(s, &coreGRPCServer{
		server: p.server,
	})
	return nil
}

func (p *CoreGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &coreGRPCClient{client: pluginv2.NewCoreClient(c)}, nil
}

type coreGRPCServer struct {
	server pluginv2.CoreServer
}

func (s *coreGRPCServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return s.server.DataQuery(ctx, req)
}

func (s *coreGRPCServer) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return s.server.Resource(ctx, req)
}

type coreGRPCClient struct {
	client pluginv2.CoreClient
}

func (m *coreGRPCClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.client.DataQuery(ctx, req)
}

func (m *coreGRPCClient) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return m.client.Resource(ctx, req)
}
