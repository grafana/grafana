package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
)

type transformWrapper struct {
	plugin.NetRPCUnsupportedPlugin

	handlers TransformHandlers
}

func (t *transformWrapper) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest, callBack TransformCallBack) (*pluginv2.DataQueryResponse, error) {
	pc := pluginConfigFromProto(req.Config)
	queries := make([]DataQuery, len(req.Queries))
	for i, q := range req.Queries {
		queries[i] = *dataQueryFromProtobuf(q)
	}

	resp, err := t.handlers.DataQuery(ctx, pc, req.Headers, queries, &transformCallBackWrapper{callBack})
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
