package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type GRPCClient struct {
	client pluginv2.DatasourcePluginClient
}

// DatasourcePlugin is the Grafana datasource plugin interface.
type DatasourcePlugin interface {
	Query(ctx context.Context, req *pluginv2.DatasourceRequest) (*pluginv2.DatasourceResponse, error)
}

type grpcServer struct {
	Impl datasourcePluginWrapper
}

func (m *GRPCClient) Query(ctx context.Context, req *pluginv2.DatasourceRequest) (*pluginv2.DatasourceResponse, error) {
	return m.client.Query(ctx, req)
}

func (m *grpcServer) Query(ctx context.Context, req *pluginv2.DatasourceRequest) (*pluginv2.DatasourceResponse, error) {
	return m.Impl.Query(ctx, req)
}
