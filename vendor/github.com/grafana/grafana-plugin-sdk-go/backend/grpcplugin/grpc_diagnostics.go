package grpcplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// DiagnosticsServer is the server API for the Diagnostics service.
type DiagnosticsServer interface {
	pluginv2.DiagnosticsServer
}

// DiagnosticsClient is the client API for the Diagnostics service.
type DiagnosticsClient interface {
	pluginv2.DiagnosticsClient
}

// DiagnosticsGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type DiagnosticsGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	DiagnosticsServer DiagnosticsServer
}

// GRPCServer registers p as a diagnostics gRPC server.
func (p *DiagnosticsGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterDiagnosticsServer(s, &diagnosticsGRPCServer{
		server: p.DiagnosticsServer,
	})
	return nil
}

// GRPCClient returns c as a diagnostics gRPC client.
func (p *DiagnosticsGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &diagnosticsGRPCClient{client: pluginv2.NewDiagnosticsClient(c)}, nil
}

type diagnosticsGRPCServer struct {
	server DiagnosticsServer
}

// CollectMetrics collects metrics.
func (s *diagnosticsGRPCServer) CollectMetrics(ctx context.Context, req *pluginv2.CollectMetricsRequest) (*pluginv2.CollectMetricsResponse, error) {
	return s.server.CollectMetrics(ctx, req)
}

// CheckHealth checks health.
func (s *diagnosticsGRPCServer) CheckHealth(ctx context.Context, req *pluginv2.CheckHealthRequest) (*pluginv2.CheckHealthResponse, error) {
	return s.server.CheckHealth(ctx, req)
}

type diagnosticsGRPCClient struct {
	client pluginv2.DiagnosticsClient
}

// CollectMetrics collects metrics.
func (s *diagnosticsGRPCClient) CollectMetrics(ctx context.Context, req *pluginv2.CollectMetricsRequest, opts ...grpc.CallOption) (*pluginv2.CollectMetricsResponse, error) {
	return s.client.CollectMetrics(ctx, req, opts...)
}

// CheckHealth checks health.
func (s *diagnosticsGRPCClient) CheckHealth(ctx context.Context, req *pluginv2.CheckHealthRequest, opts ...grpc.CallOption) (*pluginv2.CheckHealthResponse, error) {
	return s.client.CheckHealth(ctx, req, opts...)
}

var _ DiagnosticsServer = &diagnosticsGRPCServer{}
var _ DiagnosticsClient = &diagnosticsGRPCClient{}
