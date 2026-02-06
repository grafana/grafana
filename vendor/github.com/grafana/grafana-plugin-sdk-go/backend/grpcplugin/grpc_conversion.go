package grpcplugin

import (
	"context"

	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// ConversionServer represents an admission control server.
type ConversionServer interface {
	pluginv2.ResourceConversionServer
}

// ConversionClient represents an resource conversion client.
type ConversionClient interface {
	pluginv2.ResourceConversionClient
}

// ConversionGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type ConversionGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	ConversionServer ConversionServer
}

// GRPCServer registers p as an resource conversion gRPC server.
func (p *ConversionGRPCPlugin) GRPCServer(_ *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterResourceConversionServer(s, &conversionGRPCServer{
		server: p.ConversionServer,
	})
	return nil
}

// GRPCClient returns c as an resource conversion gRPC client.
func (p *ConversionGRPCPlugin) GRPCClient(_ context.Context, _ *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &conversionGRPCClient{client: pluginv2.NewResourceConversionClient(c)}, nil
}

type conversionGRPCServer struct {
	server ConversionServer
}

func (s *conversionGRPCServer) ConvertObjects(ctx context.Context, req *pluginv2.ConversionRequest) (*pluginv2.ConversionResponse, error) {
	return s.server.ConvertObjects(ctx, req)
}

type conversionGRPCClient struct {
	client pluginv2.ResourceConversionClient
}

func (s *conversionGRPCClient) ConvertObjects(ctx context.Context, req *pluginv2.ConversionRequest, opts ...grpc.CallOption) (*pluginv2.ConversionResponse, error) {
	return s.client.ConvertObjects(ctx, req, opts...)
}

var _ ConversionServer = &conversionGRPCServer{}
var _ ConversionClient = &conversionGRPCClient{}
