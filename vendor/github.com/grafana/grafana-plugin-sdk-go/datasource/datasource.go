package datasource

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
)

// TimeRange represents a time range for a query.
type TimeRange struct {
	From time.Time
	To   time.Time
}

// DataSourceInfo holds metadata for the queried data source.
type DataSourceInfo struct {
	ID       int64
	OrgID    int64
	Name     string
	Type     string
	URL      string
	JSONData json.RawMessage
}

// Query represents the query as sent from the frontend.
type Query struct {
	RefID         string
	MaxDataPoints int64
	Interval      time.Duration
	ModelJSON     json.RawMessage
}

// QueryResult holds the results for a given query.
type QueryResult struct {
	Error      string
	RefID      string
	MetaJSON   string
	DataFrames []*dataframe.Frame
}

// DataSourceHandler handles data source queries.
type DataSourceHandler interface {
	Query(ctx context.Context, tr TimeRange, ds DataSourceInfo, queries []Query) ([]QueryResult, error)
}

// datasourcePluginWrapper converts to and from protobuf types.
type datasourcePluginWrapper struct {
	plugin.NetRPCUnsupportedPlugin

	handler DataSourceHandler
}

func (p *datasourcePluginWrapper) Query(ctx context.Context, req *pluginv2.DatasourceRequest) (*pluginv2.DatasourceResponse, error) {
	tr := TimeRange{
		From: time.Unix(0, req.TimeRange.FromEpochMs*int64(time.Millisecond)),
		To:   time.Unix(0, req.TimeRange.ToEpochMs*int64(time.Millisecond)),
	}

	dsi := DataSourceInfo{
		ID:       req.Datasource.Id,
		OrgID:    req.Datasource.OrgId,
		Name:     req.Datasource.Name,
		Type:     req.Datasource.Type,
		URL:      req.Datasource.Url,
		JSONData: json.RawMessage(req.Datasource.JsonData),
	}

	var queries []Query
	for _, q := range req.Queries {
		queries = append(queries, Query{
			RefID:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
			Interval:      time.Duration(q.IntervalMs) * time.Millisecond,
			ModelJSON:     []byte(q.ModelJson),
		})
	}

	results, err := p.handler.Query(ctx, tr, dsi, queries)
	if err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return &pluginv2.DatasourceResponse{
			Results: []*pluginv2.DatasourceQueryResult{},
		}, nil
	}

	var respResults []*pluginv2.DatasourceQueryResult

	for _, res := range results {
		encodedFrames := make([][]byte, len(res.DataFrames))
		for dfIdx, df := range res.DataFrames {
			if len(df.Fields) == 0 {
				continue
			}
			encodedFrames[dfIdx], err = dataframe.MarshalArrow(df)
			if err != nil {
				return nil, err
			}
		}

		queryResult := &pluginv2.DatasourceQueryResult{
			Error:      res.Error,
			RefId:      res.RefID,
			MetaJson:   res.MetaJSON,
			Dataframes: encodedFrames,
		}

		respResults = append(respResults, queryResult)
	}

	return &pluginv2.DatasourceResponse{
		Results: respResults,
	}, nil
}

// DatasourceQueryResult holds the results for a given query.
type DatasourceQueryResult struct {
	Error      string
	RefID      string
	MetaJSON   string
	DataFrames []*dataframe.Frame
}
