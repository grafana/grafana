package grafana

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

// DatasourcePluginImpl implements the plugin interface from github.com/hashicorp/go-plugin.
type DatasourcePluginImpl struct {
	plugin.NetRPCUnsupportedPlugin

	Impl datasourcePluginWrapper
}

func (p *DatasourcePluginImpl) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	datasource.RegisterDatasourcePluginServer(s, &grpcServer{
		Impl:   p.Impl,
		broker: broker,
	})
	return nil
}

func (p *DatasourcePluginImpl) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &GRPCClient{client: datasource.NewDatasourcePluginClient(c), broker: broker}, nil
}
