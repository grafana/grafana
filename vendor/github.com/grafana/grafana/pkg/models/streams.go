package models

import (
	"github.com/grafana/grafana/pkg/components/null"
)

type TimePoint [2]null.Float
type TimeSeriesPoints []TimePoint

type StreamPacket struct {
	Stream string         `json:"stream"`
	Series []StreamSeries `json:"series"`
}

type StreamSeries struct {
	Name   string           `json:"name"`
	Points TimeSeriesPoints `json:"points"`
}

type StreamInfo struct {
	Name string
}

type StreamList []*StreamInfo

type StreamManager interface {
	GetStreamList() StreamList
	Push(data *StreamPacket)
}
