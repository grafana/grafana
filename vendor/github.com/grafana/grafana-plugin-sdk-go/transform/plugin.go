package transform

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// GrafanaAPI is the Grafana API interface that allows a datasource plugin to callback and request additional information from Grafana.
type GrafanaAPI interface {
	QueryDatasource(ctx context.Context, req *pluginv2.QueryDatasourceRequest) (*pluginv2.QueryDatasourceResponse, error)
}

// TransformPlugin is the Grafana transform plugin interface.
type TransformPlugin interface {
	Transform(ctx context.Context, req *pluginv2.TransformRequest, api GrafanaAPI) (*pluginv2.TransformResponse, error)
}

// TransformPluginImpl implements the plugin interface from github.com/hashicorp/go-plugin.
type TransformPluginImpl struct {
	plugin.NetRPCUnsupportedPlugin
	Impl transformPluginWrapper
}

// GRPCServer implements the server for a TransformPlugin
func (p *TransformPluginImpl) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterTransformPluginServer(s, &GRPCServer{
		Impl:   p.Impl,
		broker: broker,
	})
	return nil
}

// GRPCClient implements the client for a TransformPlugin
func (p *TransformPluginImpl) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &GRPCClient{client: pluginv2.NewTransformPluginClient(c), broker: broker}, nil
}

var _ plugin.GRPCPlugin = &TransformPluginImpl{}
