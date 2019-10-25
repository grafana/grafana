package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
)

type GRPCClient struct {
	client datasource.DatasourcePluginClient
}

// DatasourcePlugin is the Grafana datasource interface.
type DatasourcePlugin interface {
	Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error)
}

type grpcServer struct {
	Impl datasourcePluginWrapper
}

func (m *GRPCClient) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	return m.client.Query(ctx, req)
}

func (m *grpcServer) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	return m.Impl.Query(ctx, req)
}
