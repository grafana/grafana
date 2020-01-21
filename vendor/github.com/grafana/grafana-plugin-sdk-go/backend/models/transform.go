package models

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

type TransformCallBack interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error)
}

type TransformServer interface {
	TransformData(ctx context.Context, req *pluginv2.DataQueryRequest, callback TransformCallBack) (*pluginv2.DataQueryResponse, error)
}
