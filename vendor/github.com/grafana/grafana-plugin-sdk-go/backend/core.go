package backend

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// PluginConfig holds configuration for the queried plugin.
type PluginConfig struct {
	ID       int64
	OrgID    int64
	Name     string
	Type     string
	URL      string
	JSONData json.RawMessage
}

// PluginConfigFromProto converts the generated protobuf PluginConfig to this
// package's PluginConfig.
func pluginConfigFromProto(pc *pluginv2.PluginConfig) PluginConfig {
	return PluginConfig{
		ID:       pc.Id,
		OrgID:    pc.OrgId,
		Name:     pc.Name,
		Type:     pc.Type,
		URL:      pc.Url,
		JSONData: json.RawMessage([]byte(pc.JsonData)),
	}
}

func (pc PluginConfig) toProtobuf() *pluginv2.PluginConfig {
	return &pluginv2.PluginConfig{
		Id:       pc.ID,
		OrgId:    pc.OrgID,
		Name:     pc.Name,
		Type:     pc.Type,
		Url:      pc.URL,
		JsonData: string(pc.JSONData),
	}
}

type DataQueryRequest struct {
	PluginConfig PluginConfig
	Headers      map[string]string
	Queries      []DataQuery
}

func dataQueryRequestFromProto(pc *pluginv2.DataQueryRequest) *DataQueryRequest {
	queries := make([]DataQuery, len(pc.Queries))
	for i, q := range pc.Queries {
		queries[i] = *dataQueryFromProtobuf(q)
	}
	return &DataQueryRequest{
		PluginConfig: pluginConfigFromProto(pc.Config),
		Headers:      pc.Headers,
		Queries:      queries,
	}
}

func (dr *DataQueryRequest) toProtobuf() *pluginv2.DataQueryRequest {
	queries := make([]*pluginv2.DataQuery, len(dr.Queries))
	for i, q := range dr.Queries {
		queries[i] = q.toProtobuf()
	}
	return &pluginv2.DataQueryRequest{
		Config:  dr.PluginConfig.toProtobuf(),
		Headers: dr.Headers,
		Queries: queries,
	}

}

// DataQuery represents the query as sent from the frontend.
type DataQuery struct {
	RefID         string
	MaxDataPoints int64
	Interval      time.Duration
	TimeRange     TimeRange
	JSON          json.RawMessage
}

func (q *DataQuery) toProtobuf() *pluginv2.DataQuery {
	return &pluginv2.DataQuery{
		RefId:         q.RefID,
		MaxDataPoints: q.MaxDataPoints,
		IntervalMS:    q.Interval.Microseconds(),
		TimeRange:     q.TimeRange.toProtobuf(),
		Json:          q.JSON,
	}
}

func dataQueryFromProtobuf(q *pluginv2.DataQuery) *DataQuery {
	return &DataQuery{
		RefID:         q.RefId,
		MaxDataPoints: q.MaxDataPoints,
		TimeRange:     timeRangeFromProtobuf(q.TimeRange),
		Interval:      time.Duration(q.IntervalMS) * time.Millisecond,
		JSON:          []byte(q.Json),
	}
}

// DataQueryResponse holds the results for a given query.
type DataQueryResponse struct {
	Frames   []*dataframe.Frame
	Metadata map[string]string
}

func (res *DataQueryResponse) toProtobuf() (*pluginv2.DataQueryResponse, error) {
	encodedFrames := make([][]byte, len(res.Frames))
	var err error
	for i, frame := range res.Frames {
		encodedFrames[i], err = dataframe.MarshalArrow(frame)
		if err != nil {
			return nil, err
		}
	}

	return &pluginv2.DataQueryResponse{
		Frames:   encodedFrames,
		Metadata: res.Metadata,
	}, nil
}

func dataQueryResponseFromProtobuf(res *pluginv2.DataQueryResponse) (*DataQueryResponse, error) {
	frames := make([]*dataframe.Frame, len(res.Frames))
	var err error
	for i, encodedFrame := range res.Frames {
		frames[i], err = dataframe.UnmarshalArrow(encodedFrame)
		if err != nil {
			return nil, err
		}
	}
	return &DataQueryResponse{Metadata: res.Metadata, Frames: frames}, nil
}

// TimeRange represents a time range for a query.
type TimeRange struct {
	From time.Time
	To   time.Time
}

func (tr *TimeRange) toProtobuf() *pluginv2.TimeRange {
	return &pluginv2.TimeRange{
		FromEpochMS: tr.From.UnixNano() / int64(time.Millisecond),
		ToEpochMS:   tr.To.UnixNano() / int64(time.Millisecond),
	}
}

// TimeRangeFromProtobuf converts the generated protobuf TimeRange to this
// package's FetchInfo.
func timeRangeFromProtobuf(tr *pluginv2.TimeRange) TimeRange {
	return TimeRange{
		From: time.Unix(0, tr.FromEpochMS*int64(time.Millisecond)),
		To:   time.Unix(0, tr.ToEpochMS*int64(time.Millisecond)),
	}
}

type ResourceRequest struct {
	PluginConfig PluginConfig
	Headers      map[string]string
	Method       string
	Path         string
	Body         []byte
}

func resourceRequestFromProtobuf(req *pluginv2.ResourceRequest) *ResourceRequest {
	return &ResourceRequest{
		PluginConfig: pluginConfigFromProto(req.Config),
		Headers:      req.Headers,
		Method:       req.Method,
		Path:         req.Path,
		Body:         req.Body,
	}
}

type ResourceResponse struct {
	Headers map[string]string
	Code    int32
	Body    []byte
}

func (rr *ResourceResponse) toProtobuf() *pluginv2.ResourceResponse {
	return &pluginv2.ResourceResponse{
		Headers: rr.Headers,
		Code:    rr.Code,
		Body:    rr.Body,
	}
}

// DataQueryHandler handles data source queries.
type DataQueryHandler interface {
	DataQuery(ctx context.Context, req *DataQueryRequest) (*DataQueryResponse, error)
}

// ResourceHandler handles backend plugin checks.
type ResourceHandler interface {
	Resource(ctx context.Context, req *ResourceRequest) (*ResourceResponse, error)
}

// PluginHandlers is the collection of handlers that corresponds to the
// grpc "service BackendPlugin".
type PluginHandlers interface {
	DataQueryHandler
	ResourceHandler
}

// BackendPlugin is the Grafana backend plugin interface.
type BackendPlugin interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error)
	Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error)
}
