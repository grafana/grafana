package grafana

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type GRPCClient struct {
	broker *plugin.GRPCBroker
	client datasource.DatasourcePluginClient
}

// DatasourcePlugin is the Grafana datasource interface.
type DatasourcePlugin interface {
	Query(ctx context.Context, req *datasource.DatasourceRequest, api GrafanaAPI) (*datasource.DatasourceResponse, error)
}

// GrafanaAPI is the Grafana API interface that allows a datasource plugin to callback and request additional information from Grafana.
type GrafanaAPI interface {
	QueryDatasource(ctx context.Context, req *datasource.QueryDatasourceRequest) (*datasource.QueryDatasourceResponse, error)
}

func (m *GRPCClient) Query(ctx context.Context, req *datasource.DatasourceRequest, api GrafanaAPI) (*datasource.DatasourceResponse, error) {
	apiServer := &GRPCGrafanaAPIServer{Impl: api}

	var s *grpc.Server
	serverFunc := func(opts []grpc.ServerOption) *grpc.Server {
		s = grpc.NewServer(opts...)
		datasource.RegisterGrafanaAPIServer(s, apiServer)

		return s
	}
	brokeId := m.broker.NextId()
	go m.broker.AcceptAndServe(brokeId, serverFunc)

	req.RequestId = brokeId
	res, err := m.client.Query(ctx, req)

	s.Stop()
	return res, err
}

type grpcServer struct {
	broker *plugin.GRPCBroker
	Impl   datasourcePluginWrapper
}

func (m *grpcServer) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	conn, err := m.broker.Dial(req.RequestId)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	api := &GRPCGrafanaAPIClient{datasource.NewGrafanaAPIClient(conn)}
	return m.Impl.Query(ctx, req, api)
}

// GRPCGrafanaAPIClient is an implementation of GrafanaAPIClient that talks over RPC.
type GRPCGrafanaAPIClient struct{ client datasource.GrafanaAPIClient }

func (m *GRPCGrafanaAPIClient) QueryDatasource(ctx context.Context, req *datasource.QueryDatasourceRequest) (*datasource.QueryDatasourceResponse, error) {
	resp, err := m.client.QueryDatasource(ctx, req)
	if err != nil {
		hclog.Default().Info("grafana.QueryDatasource", "client", "start", "err", err)
		return nil, err
	}
	return resp, err
}

// GRPCGrafanaAPIServer is the gRPC server that GRPCGrafanaAPIClient talks to.
type GRPCGrafanaAPIServer struct {
	Impl GrafanaAPI
}

func (m *GRPCGrafanaAPIServer) QueryDatasource(ctx context.Context, req *datasource.QueryDatasourceRequest) (*datasource.QueryDatasourceResponse, error) {
	resp, err := m.Impl.QueryDatasource(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
