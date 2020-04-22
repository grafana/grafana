package backend

import (
	"context"
)

type TransformHandlers interface {
	TransformDataHandler
}

type TransformDataHandler interface {
	TransformData(ctx context.Context, req *QueryDataRequest, callBack TransformDataCallBackHandler) (*QueryDataResponse, error)
}

// Callback

type TransformDataCallBackHandler interface {
	// TODO: Forget if I actually need PluginConfig on the callback or not.
	QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error)
}
