package transform

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// GRPCClient is an implementation of TransformPluginClient that talks over RPC.
type GRPCClient struct {
	broker *plugin.GRPCBroker
	client pluginv2.TransformPluginClient
}

func (m *GRPCClient) Transform(ctx context.Context, req *pluginv2.TransformRequest, api GrafanaAPI) (*pluginv2.TransformResponse, error) {
	apiServer := &GRPCGrafanaAPIServer{Impl: api}

	var s *grpc.Server
	serverFunc := func(opts []grpc.ServerOption) *grpc.Server {
		s = grpc.NewServer(opts...)
		pluginv2.RegisterGrafanaAPIServer(s, apiServer)

		return s
	}
	brokeID := m.broker.NextId()
	go m.broker.AcceptAndServe(brokeID, serverFunc)

	req.RequestId = brokeID
	res, err := m.client.Transform(ctx, req)

	s.Stop()
	return res, err
}

// GRPCServer is the gRPC server that GRPCClient talks to.
type GRPCServer struct {
	broker *plugin.GRPCBroker
	Impl   transformPluginWrapper
}

func (m *GRPCServer) Transform(ctx context.Context, req *pluginv2.TransformRequest) (*pluginv2.TransformResponse, error) {
	conn, err := m.broker.Dial(req.RequestId)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	api := &GRPCGrafanaAPIClient{pluginv2.NewGrafanaAPIClient(conn)}
	return m.Impl.Transform(ctx, req, api)
}

// GRPCGrafanaAPIClient is an implementation of GrafanaAPIClient that talks over RPC.
type GRPCGrafanaAPIClient struct{ client pluginv2.GrafanaAPIClient }

func (m *GRPCGrafanaAPIClient) QueryDatasource(ctx context.Context, req *pluginv2.QueryDatasourceRequest) (*pluginv2.QueryDatasourceResponse, error) {
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

func (m *GRPCGrafanaAPIServer) QueryDatasource(ctx context.Context, req *pluginv2.QueryDatasourceRequest) (*pluginv2.QueryDatasourceResponse, error) {
	resp, err := m.Impl.QueryDatasource(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
