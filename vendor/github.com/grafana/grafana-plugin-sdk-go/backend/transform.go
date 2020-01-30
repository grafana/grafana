package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type TransformHandlers interface {
	TransformDataHandler
}

type TransformDataHandler interface {
	TransformData(ctx context.Context, req *DataQueryRequest, callBack TransformCallBackHandler) (*DataQueryResponse, error)
}

// Callback

type TransformCallBackHandler interface {
	// TODO: Forget if I actually need PluginConfig on the callback or not.
	DataQuery(ctx context.Context, req *DataQueryRequest) (*DataQueryResponse, error)
}

type transformCallBackWrapper struct {
	callBack TransformCallBack
}

func (tw *transformCallBackWrapper) DataQuery(ctx context.Context, req *DataQueryRequest) (*DataQueryResponse, error) {
	protoRes, err := tw.callBack.DataQuery(ctx, req.toProtobuf())
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
