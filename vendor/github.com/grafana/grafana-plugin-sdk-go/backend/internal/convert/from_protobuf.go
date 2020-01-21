package convert

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/models"
	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type FromProtobuf struct {
}

func FromProto() FromProtobuf {
	return FromProtobuf{}
}

func (f FromProtobuf) PluginConfig(proto *pluginv2.PluginConfig) models.PluginConfig {
	return models.PluginConfig{
		ID:       proto.Id,
		OrgID:    proto.OrgId,
		Name:     proto.Name,
		Type:     proto.Type,
		URL:      proto.Url,
		JSONData: json.RawMessage([]byte(proto.JsonData)),
	}
}

func (f FromProtobuf) TimeRange(proto *pluginv2.TimeRange) models.TimeRange {
	return models.TimeRange{
		From: time.Unix(0, proto.FromEpochMS*int64(time.Millisecond)),
		To:   time.Unix(0, proto.ToEpochMS*int64(time.Millisecond)),
	}
}

func (f FromProtobuf) DataQuery(proto *pluginv2.DataQuery) *models.DataQuery {
	return &models.DataQuery{
		RefID:         proto.RefId,
		MaxDataPoints: proto.MaxDataPoints,
		TimeRange:     f.TimeRange(proto.TimeRange),
		Interval:      time.Duration(proto.IntervalMS) * time.Millisecond,
		JSON:          []byte(proto.Json),
	}
}

func (f FromProtobuf) DataQueryRequest(protoReq *pluginv2.DataQueryRequest) *models.DataQueryRequest {
	queries := make([]models.DataQuery, len(protoReq.Queries))
	for i, q := range protoReq.Queries {
		queries[i] = *f.DataQuery(q)
	}
	return &models.DataQueryRequest{
		PluginConfig: f.PluginConfig(protoReq.Config),
		Headers:      protoReq.Headers,
		Queries:      queries,
	}
}

func (f FromProtobuf) DataQueryResponse(protoRes *pluginv2.DataQueryResponse) (*models.DataQueryResponse, error) {
	frames := make([]*dataframe.Frame, len(protoRes.Frames))
	var err error
	for i, encodedFrame := range protoRes.Frames {
		frames[i], err = dataframe.UnmarshalArrow(encodedFrame)
		if err != nil {
			return nil, err
		}
	}
	return &models.DataQueryResponse{Metadata: protoRes.Metadata, Frames: frames}, nil
}

func (f FromProtobuf) CallResourceRequest(protoReq *pluginv2.CallResource_Request) *models.ResourceRequestContext {
	return models.NewResourceRequestContext(f.PluginConfig(protoReq.Config), protoReq.Params)
}
