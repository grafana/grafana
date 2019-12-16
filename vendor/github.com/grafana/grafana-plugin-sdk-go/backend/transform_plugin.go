package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type TransformPlugin interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest, callback TransformCallBack) (*pluginv2.DataQueryResponse, error)
}

// TransformImpl implements the plugin interface from github.com/hashicorp/go-plugin.
type TransformImpl struct {
	plugin.NetRPCUnsupportedPlugin

	Wrap transformWrapper
}

func (t *TransformImpl) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterTransformServer(s, &TransformGRPCServer{
		Impl:   t.Wrap,
		broker: broker,
	})
	return nil
}

func (t *TransformImpl) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &TransformGRPCClient{client: pluginv2.NewTransformClient(c), broker: broker}, nil
}

// Callback

type TransformCallBack interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error)
}
