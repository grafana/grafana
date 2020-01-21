package adapter

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend/internal/convert"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func (a *SDKAdapter) CheckHealth(ctx context.Context, protoReq *pluginv2.CheckHealth_Request) (*pluginv2.CheckHealth_Response, error) {
	if a.CheckHealthHandler != nil {
		res, err := a.CheckHealthHandler.CheckHealth(ctx)
		if err != nil {
			return nil, err
		}
		return convert.ToProto().CheckHealthResponse(res), nil
	}

	return &pluginv2.CheckHealth_Response{
		Status: pluginv2.CheckHealth_Response_OK,
	}, nil
}
