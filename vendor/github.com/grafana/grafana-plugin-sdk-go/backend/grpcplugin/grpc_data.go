package grpcplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type DataServer interface {
	pluginv2.DataServer
}

type DataClient interface {
	pluginv2.DataClient
}

// DataGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type DataGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	DataServer DataServer
}

func (p *DataGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterDataServer(s, &dataGRPCServer{
		server: p.DataServer,
	})
	return nil
}

func (p *DataGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &dataGRPCClient{client: pluginv2.NewDataClient(c)}, nil
}

type dataGRPCServer struct {
	server DataServer
}

func (s *dataGRPCServer) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	return s.server.QueryData(ctx, req)
}

type dataGRPCClient struct {
	client pluginv2.DataClient
}

func (m *dataGRPCClient) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	return m.client.QueryData(ctx, req, opts...)
}

var _ DataServer = &dataGRPCServer{}
var _ DataClient = &dataGRPCClient{}
