package grafana

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
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
	Query(ctx context.Context, tr TimeRange, ds DataSourceInfo, queries []Query, api GrafanaAPIHandler) ([]QueryResult, error)
}

// datasourcePluginWrapper converts to and from protobuf types.
type datasourcePluginWrapper struct {
	plugin.NetRPCUnsupportedPlugin

	handler DataSourceHandler
}

func (p *datasourcePluginWrapper) Query(ctx context.Context, req *datasource.DatasourceRequest, api GrafanaAPI) (*datasource.DatasourceResponse, error) {
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

	results, err := p.handler.Query(ctx, tr, dsi, queries, &grafanaAPIWrapper{api: api})
	if err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return &datasource.DatasourceResponse{
			Results: []*datasource.QueryResult{},
		}, nil
	}

	var respResults []*datasource.QueryResult

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

		queryResult := &datasource.QueryResult{
			Error:      res.Error,
			RefId:      res.RefID,
			MetaJson:   res.MetaJSON,
			Dataframes: encodedFrames,
		}

		respResults = append(respResults, queryResult)
	}

	return &datasource.DatasourceResponse{
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

// GrafanaAPIHandler handles data source queries.
type GrafanaAPIHandler interface {
	QueryDatasource(ctx context.Context, orgID int64, datasourceID int64, tr TimeRange, queries []Query) ([]DatasourceQueryResult, error)
}

// grafanaAPIWrapper converts to and from Grafana types for calls from a datasource.
type grafanaAPIWrapper struct {
	api GrafanaAPI
}

func (w *grafanaAPIWrapper) QueryDatasource(ctx context.Context, orgID int64, datasourceID int64, tr TimeRange, queries []Query) ([]DatasourceQueryResult, error) {
	rawQueries := make([]*datasource.Query, 0, len(queries))

	for _, q := range queries {
		rawQueries = append(rawQueries, &datasource.Query{
			RefId:         q.RefID,
			MaxDataPoints: q.MaxDataPoints,
			IntervalMs:    q.Interval.Milliseconds(),
			ModelJson:     string(q.ModelJSON),
		})
	}

	rawResp, err := w.api.QueryDatasource(ctx, &datasource.QueryDatasourceRequest{
		OrgId:        orgID,
		DatasourceId: datasourceID,
		TimeRange: &datasource.TimeRange{
			FromEpochMs: tr.From.UnixNano() / 1e6,
			ToEpochMs:   tr.To.UnixNano() / 1e6,
			FromRaw:     fmt.Sprintf("%v", tr.From.UnixNano()/1e6),
			ToRaw:       fmt.Sprintf("%v", tr.To.UnixNano()/1e6),
		},
		Queries: rawQueries,
	})
	if err != nil {
		return nil, err
	}

	results := make([]DatasourceQueryResult, len(rawResp.GetResults()))

	for resIdx, rawRes := range rawResp.GetResults() {
		// TODO Error property etc
		dfs := make([]*dataframe.Frame, len(rawRes.Dataframes))
		for dfIdx, b := range rawRes.Dataframes {
			dfs[dfIdx], err = dataframe.UnMarshalArrow(b)
			if err != nil {
				return nil, err
			}
		}
		results[resIdx] = DatasourceQueryResult{
			DataFrames: dfs,
		}
	}

	return results, nil
}
