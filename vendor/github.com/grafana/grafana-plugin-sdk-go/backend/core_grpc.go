package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type CoreGRPCClient struct {
	client pluginv2.CoreClient
}

// Plugin is the Grafana Backend plugin interface.
// It corresponds to: grafana.plugin protobuf: BackendPlugin Service | genproto/go/grafana_plugin: BackendPluginClient interface
type Plugin interface {
	Check(ctx context.Context, req *pluginv2.PluginStatusRequest) (*pluginv2.PluginStatusResponse, error)
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error)
	Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error)
}

type coreGRPCServer struct {
	Impl coreWrapper
}

func (m *CoreGRPCClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.client.DataQuery(ctx, req)
}

func (m *coreGRPCServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return m.Impl.DataQuery(ctx, req)
}

func (m *CoreGRPCClient) Check(ctx context.Context, req *pluginv2.PluginStatusRequest) (*pluginv2.PluginStatusResponse, error) {
	return m.client.Check(ctx, req)
}

func (m *coreGRPCServer) Check(ctx context.Context, req *pluginv2.PluginStatusRequest) (*pluginv2.PluginStatusResponse, error) {
	return m.Impl.Check(ctx, req)
}

func (m *CoreGRPCClient) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return m.client.Resource(ctx, req)
}

func (m *coreGRPCServer) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	return m.Impl.Resource(ctx, req)
}
