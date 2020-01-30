package backend

import (
	"bytes"
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/expfmt"
)

// sdkAdapter adapter between protobuf and SDK interfaces.
type sdkAdapter struct {
	checkHealthHandler   CheckHealthHandler
	dataQueryHandler     DataQueryHandler
	resourceHandler      ResourceHandler
	transformDataHandler TransformDataHandler
}

func (a *sdkAdapter) CollectMetrics(ctx context.Context, protoReq *pluginv2.CollectMetrics_Request) (*pluginv2.CollectMetrics_Response, error) {
	mfs, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	for _, mf := range mfs {
		_, err := expfmt.MetricFamilyToText(&buf, mf)
		if err != nil {
			return nil, err
		}
	}

	return &pluginv2.CollectMetrics_Response{
		Metrics: &pluginv2.CollectMetrics_Payload{
			Prometheus: buf.Bytes(),
		},
	}, nil
}

func (a *sdkAdapter) CheckHealth(ctx context.Context, protoReq *pluginv2.CheckHealth_Request) (*pluginv2.CheckHealth_Response, error) {
	if a.checkHealthHandler != nil {
		res, err := a.checkHealthHandler.CheckHealth(ctx)
		if err != nil {
			return nil, err
		}
		return res.toProtobuf(), nil
	}

	return &pluginv2.CheckHealth_Response{
		Status: pluginv2.CheckHealth_Response_OK,
	}, nil
}

func (a *sdkAdapter) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	resp, err := a.dataQueryHandler.DataQuery(ctx, dataQueryRequestFromProto(req))
	if err != nil {
		return nil, err
	}

	return resp.toProtobuf()
}

func (a *sdkAdapter) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	res, err := a.resourceHandler.Resource(ctx, resourceRequestFromProtobuf(req))
	if err != nil {
		return nil, err
	}
	return res.toProtobuf(), nil
}

func (a *sdkAdapter) TransformData(ctx context.Context, req *pluginv2.DataQueryRequest, callBack TransformCallBack) (*pluginv2.DataQueryResponse, error) {
	resp, err := a.transformDataHandler.TransformData(ctx, dataQueryRequestFromProto(req), &transformCallBackWrapper{callBack})
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
