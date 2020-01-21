package backend

import (
	"context"
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
