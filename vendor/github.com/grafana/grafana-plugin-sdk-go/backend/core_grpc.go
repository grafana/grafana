package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// CoreGRPCPlugin implements the GRPPlugin interface from github.com/hashicorp/go-plugin.
type CoreGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	adapter *sdkAdapter
}

func (p *CoreGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterCoreServer(s, &coreGRPCServer{
		adapter: p.adapter,
	})
	return nil
}

func (p *CoreGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &coreGRPCClient{client: pluginv2.NewCoreClient(c)}, nil
}

type coreGRPCServer struct {
	adapter *sdkAdapter
}

func (s *coreGRPCServer) CollectMetrics(ctx context.Context, req *pluginv2.CollectMetrics_Request) (*pluginv2.CollectMetrics_Response, error) {
	return s.adapter.CollectMetrics(ctx, req)
}

func (s *coreGRPCServer) CheckHealth(ctx context.Context, req *pluginv2.CheckHealth_Request) (*pluginv2.CheckHealth_Response, error) {
	return s.adapter.CheckHealth(ctx, req)
}

func (m *coreGRPCServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.adapter.DataQuery(ctx, req)
}

func (m *coreGRPCServer) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return m.adapter.Resource(ctx, req)
}

type coreGRPCClient struct {
	client pluginv2.CoreClient
}

func (s *coreGRPCClient) CollectMetrics(ctx context.Context, req *pluginv2.CollectMetrics_Request) (*pluginv2.CollectMetrics_Response, error) {
	return s.client.CollectMetrics(ctx, req)
}

func (s *coreGRPCClient) CheckHealth(ctx context.Context, req *pluginv2.CheckHealth_Request) (*pluginv2.CheckHealth_Response, error) {
	return s.client.CheckHealth(ctx, req)
}

func (m *coreGRPCClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.client.DataQuery(ctx, req)
}

func (m *coreGRPCClient) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return m.client.Resource(ctx, req)
}
