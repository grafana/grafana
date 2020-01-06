package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type TransformHandlers interface {
	TransformDataQueryHandler
}

type TransformDataQueryHandler interface {
	DataQuery(ctx context.Context, pc PluginConfig, headers map[string]string, queries []DataQuery, callBack TransformCallBackHandler) (*DataQueryResponse, error)
}

// Callback

type TransformCallBackHandler interface {
	// TODO: Forget if I actually need PluginConfig on the callback or not.
	DataQuery(ctx context.Context, pc PluginConfig, headers map[string]string, queries []DataQuery) (*DataQueryResponse, error)
}

type transformCallBackWrapper struct {
	callBack TransformCallBack
}

func (tw *transformCallBackWrapper) DataQuery(ctx context.Context, pc PluginConfig, headers map[string]string, queries []DataQuery) (*DataQueryResponse, error) {
	protoQueries := make([]*pluginv2.DataQuery, len(queries))
	for i, q := range queries {
		protoQueries[i] = q.toProtobuf()
	}

	protoReq := &pluginv2.DataQueryRequest{
		Config:  pc.toProtobuf(),
		Queries: protoQueries,
		Headers: headers,
	}

	protoRes, err := tw.callBack.DataQuery(ctx, protoReq)
	if err != nil {
		return nil, err
	}

	return dataQueryResponseFromProtobuf(protoRes)
}

// TransformPlugin is the Grafana transform plugin interface.
type TransformPlugin interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest, callback TransformCallBack) (*pluginv2.DataQueryResponse, error)
}

// Callback

type TransformCallBack interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error)
}
