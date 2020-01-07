package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// transformSDKAdapter adapter between protobuf and SDK interfaces.
type transformSDKAdapter struct {
	handlers TransformHandlers
}

func (a *transformSDKAdapter) TransformData(ctx context.Context, req *pluginv2.DataQueryRequest, callBack TransformCallBack) (*pluginv2.DataQueryResponse, error) {
	resp, err := a.handlers.DataQuery(ctx, dataQueryRequestFromProto(req), &transformCallBackWrapper{callBack})
	if err != nil {
		return nil, err
	}

	encodedFrames := make([][]byte, len(resp.Frames))
	for i, frame := range resp.Frames {
		encodedFrames[i], err = dataframe.MarshalArrow(frame)
		if err != nil {
			return nil, err
		}
	}

	return &pluginv2.DataQueryResponse{
		Frames:   encodedFrames,
		Metadata: resp.Metadata,
	}, nil
}
