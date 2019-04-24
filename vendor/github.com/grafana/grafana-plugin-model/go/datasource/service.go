package datasource

import (
	"context"

	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type DatasourcePlugin interface {
	Query(ctx context.Context, req *DatasourceRequest) (*DatasourceResponse, error)
}

type DatasourcePluginImpl struct {
	plugin.NetRPCUnsupportedPlugin
	Plugin DatasourcePlugin
}

func (p *DatasourcePluginImpl) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	RegisterDatasourcePluginServer(s, &GRPCServer{p.Plugin})
	return nil
}

func (p *DatasourcePluginImpl) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &GRPCClient{NewDatasourcePluginClient(c)}, nil
}

type GRPCClient struct {
	DatasourcePluginClient
}

func (m *GRPCClient) Query(ctx context.Context, req *DatasourceRequest) (*DatasourceResponse, error) {
	return m.DatasourcePluginClient.Query(ctx, req)
}

type GRPCServer struct {
	DatasourcePlugin
}

func (m *GRPCServer) Query(ctx context.Context, req *DatasourceRequest) (*DatasourceResponse, error) {
	return m.DatasourcePlugin.Query(ctx, req)
}
