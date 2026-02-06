package grpcplugin

import (
	"context"

	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// DataServer represents a data server.
type DataServer interface {
	pluginv2.DataServer
}

// DataClient represents a data client.
type DataClient interface {
	pluginv2.DataClient
}

// DataGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type DataGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	DataServer DataServer
}

// GRPCServer registers p as a data gRPC server.
func (p *DataGRPCPlugin) GRPCServer(_ *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterDataServer(s, &dataGRPCServer{
		server: p.DataServer,
	})
	return nil
}

// GRPCClient returns c as a data gRPC client.
func (p *DataGRPCPlugin) GRPCClient(_ context.Context, _ *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &dataGRPCClient{client: pluginv2.NewDataClient(c)}, nil
}

type dataGRPCServer struct {
	server DataServer
}

// QueryData queries s for data.
func (s *dataGRPCServer) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	return s.server.QueryData(ctx, req)
}

func (s *dataGRPCServer) QueryChunkedData(req *pluginv2.QueryChunkedDataRequest, stream grpc.ServerStreamingServer[pluginv2.QueryChunkedDataResponse]) error {
	return s.server.QueryChunkedData(req, stream)
}

type dataGRPCClient struct {
	client pluginv2.DataClient
}

// QueryData queries m for data.
func (m *dataGRPCClient) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	return m.client.QueryData(ctx, req, opts...)
}

func (m *dataGRPCClient) QueryChunkedData(ctx context.Context, in *pluginv2.QueryChunkedDataRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv2.QueryChunkedDataResponse], error) {
	return m.client.QueryChunkedData(ctx, in, opts...)
}

var _ DataServer = &dataGRPCServer{}
var _ DataClient = &dataGRPCClient{}
