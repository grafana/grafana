package adapter

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend/internal/convert"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func (a *SDKAdapter) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	resp, err := a.DataQueryHandler.DataQuery(ctx, convert.FromProto().DataQueryRequest(req))
	if err != nil {
		return nil, err
	}

	return convert.ToProto().DataQueryResponse(resp)
}
