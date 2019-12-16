package backend

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// DataQueryHandler handles data source queries.
type DataQueryHandler interface {
	DataQuery(ctx context.Context, pc PluginConfig, headers map[string]string, queries []DataQuery) (DataQueryResponse, error)
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

func (p *coreWrapper) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {

	pc := pluginConfigFromProto(req.Config)

	queries := make([]DataQuery, len(req.Queries))
	for i, q := range req.Queries {
		queries[i] = *dataQueryFromProtobuf(q)
	}

	resp, err := p.handlers.DataQuery(ctx, pc, req.Headers, queries)
	if err != nil {
		return nil, err
	}

	return resp.toProtobuf()
}
