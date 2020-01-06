package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// BackendGRPCPlugin implements the GRPPlugin interface from github.com/hashicorp/go-plugin.
type BackendGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	adapter *sdkAdapter
}

func (p *BackendGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterCoreServer(s, &backendGRPCServer{
		adapter: p.adapter,
	})
	return nil
}

func (p *BackendGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &backendGRPCClient{client: pluginv2.NewCoreClient(c)}, nil
}

type backendGRPCServer struct {
	adapter *sdkAdapter
}

func (s *backendGRPCServer) CollectMetrics(ctx context.Context, req *pluginv2.CollectMetrics_Request) (*pluginv2.CollectMetrics_Response, error) {
	return s.adapter.CollectMetrics(ctx, req)
}

func (s *backendGRPCServer) CheckHealth(ctx context.Context, req *pluginv2.CheckHealth_Request) (*pluginv2.CheckHealth_Response, error) {
	return s.adapter.CheckHealth(ctx, req)
}

func (m *backendGRPCServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.adapter.DataQuery(ctx, req)
}

func (m *backendGRPCServer) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return m.adapter.Resource(ctx, req)
}

type backendGRPCClient struct {
	client pluginv2.CoreClient
}

func (s *backendGRPCClient) CollectMetrics(ctx context.Context, req *pluginv2.CollectMetrics_Request) (*pluginv2.CollectMetrics_Response, error) {
	return s.client.CollectMetrics(ctx, req)
}

func (s *backendGRPCClient) CheckHealth(ctx context.Context, req *pluginv2.CheckHealth_Request) (*pluginv2.CheckHealth_Response, error) {
	return s.client.CheckHealth(ctx, req)
}

func (m *backendGRPCClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.client.DataQuery(ctx, req)
}

func (m *backendGRPCClient) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return m.client.Resource(ctx, req)
}
