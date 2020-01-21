package adapter

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend/internal/convert"
	"github.com/grafana/grafana-plugin-sdk-go/backend/models"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func (a *SDKAdapter) TransformData(ctx context.Context, req *pluginv2.DataQueryRequest, callBack models.TransformCallBack) (*pluginv2.DataQueryResponse, error) {
	resp, err := a.TransformDataHandler.TransformData(ctx, convert.FromProto().DataQueryRequest(req), &transformCallBackWrapper{callBack})
	if err != nil {
		return nil, err
	}

	return convert.ToProto().DataQueryResponse(resp)
}

type transformCallBackWrapper struct {
	callBack models.TransformCallBack
}

func (tw *transformCallBackWrapper) DataQuery(ctx context.Context, req *models.DataQueryRequest) (*models.DataQueryResponse, error) {
	protoRes, err := tw.callBack.DataQuery(ctx, convert.ToProto().DataQueryRequest(req))
	if err != nil {
		return nil, err
	}

	return convert.FromProto().DataQueryResponse(protoRes)
}
