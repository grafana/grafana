package transform

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
	pdatasource "github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
	ptrans "github.com/grafana/grafana-plugin-sdk-go/genproto/transform"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type GRPCClient struct {
	broker *plugin.GRPCBroker
	client ptrans.TransformPluginClient
}

// TransformPlugin is the Grafana datasource interface.
type TransformPlugin interface {
	Query(ctx context.Context, req *pdatasource.DatasourceRequest, api GrafanaAPI) (*pdatasource.DatasourceResponse, error)
}

type grpcServer struct {
	broker *plugin.GRPCBroker
	Impl   transformPluginWrapper
}

func (m *grpcServer) Query(ctx context.Context, req *pdatasource.DatasourceRequest) (*pdatasource.DatasourceResponse, error) {
	conn, err := m.broker.Dial(req.RequestId)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	api := &GRPCGrafanaAPIClient{ptrans.NewGrafanaAPIClient(conn)}
	return m.Impl.Query(ctx, req, api)
}

func (m *GRPCClient) Query(ctx context.Context, req *datasource.DatasourceRequest, api GrafanaAPI) (*datasource.DatasourceResponse, error) {
	apiServer := &GRPCGrafanaAPIServer{Impl: api}

	var s *grpc.Server
	serverFunc := func(opts []grpc.ServerOption) *grpc.Server {
		s = grpc.NewServer(opts...)
		ptrans.RegisterGrafanaAPIServer(s, apiServer)

		return s
	}
	brokeID := m.broker.NextId()
	go m.broker.AcceptAndServe(brokeID, serverFunc)

	req.RequestId = brokeID
	res, err := m.client.Query(ctx, req)

	s.Stop()
	return res, err
}

// GRPCGrafanaAPIServer is the gRPC server that GRPCGrafanaAPIClient talks to.
type GRPCGrafanaAPIServer struct {
	Impl GrafanaAPI
}

func (m *GRPCGrafanaAPIServer) QueryDatasource(ctx context.Context, req *ptrans.QueryDatasourceRequest) (*ptrans.QueryDatasourceResponse, error) {
	resp, err := m.Impl.QueryDatasource(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GRPCGrafanaAPIClient is an implementation of GrafanaAPIClient that talks over RPC.
type GRPCGrafanaAPIClient struct{ client ptrans.GrafanaAPIClient }

func (m *GRPCGrafanaAPIClient) QueryDatasource(ctx context.Context, req *ptrans.QueryDatasourceRequest) (*ptrans.QueryDatasourceResponse, error) {
	resp, err := m.client.QueryDatasource(ctx, req)
	if err != nil {
		hclog.Default().Info("grafana.QueryDatasource", "client", "start", "err", err)
		return nil, err
	}
	return resp, err
}
