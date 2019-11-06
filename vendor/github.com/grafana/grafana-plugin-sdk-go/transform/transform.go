package transform

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/hashicorp/go-plugin"
)

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

// TransformHandler handles data source queries.
// Note: Arguments are sdk.Datasource objects
type TransformHandler interface {
	Transform(ctx context.Context, tr datasource.TimeRange, queries []Query, api GrafanaAPIHandler) ([]QueryResult, error)
}

// transformPluginWrapper converts protobuf types to sdk go types.
// This allows consumers to use the TransformHandler interface which uses sdk types instead of
// the generated protobuf types. Protobuf requests are coverted to SDK requests, and the SDK response
// are converted to protobuf response.
type transformPluginWrapper struct {
	plugin.NetRPCUnsupportedPlugin

	handler TransformHandler
}

// Transform ....
func (p *transformPluginWrapper) Transform(ctx context.Context, req *pluginv2.TransformRequest, api GrafanaAPI) (*pluginv2.TransformResponse, error) {
	// Create an SDK request from the protobuf request
	tr := datasource.TimeRange{
		From: time.Unix(0, req.TimeRange.FromEpochMs*int64(time.Millisecond)),
		To:   time.Unix(0, req.TimeRange.ToEpochMs*int64(time.Millisecond)),
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

	// Makes SDK request, get SDK response
	results, err := p.handler.Transform(ctx, tr, queries, &grafanaAPIWrapper{api: api})
	if err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return &pluginv2.TransformResponse{
			Results: []*pluginv2.TransformResult{},
		}, nil
	}

	// Convert SDK response to protobuf response
	var respResults []*pluginv2.TransformResult

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

		transResult := &pluginv2.TransformResult{
			Error:      res.Error,
			RefId:      res.RefID,
			MetaJson:   res.MetaJSON,
			Dataframes: encodedFrames,
		}

		respResults = append(respResults, transResult)
	}

	return &pluginv2.TransformResponse{
		Results: respResults,
	}, nil
}

// GrafanaAPIHandler handles querying other data sources from the transform plugin.
type GrafanaAPIHandler interface {
	QueryDatasource(ctx context.Context, orgID int64, datasourceID int64, tr datasource.TimeRange, queries []datasource.Query) ([]datasource.DatasourceQueryResult, error)
}

// grafanaAPIWrapper converts protobuf types to sdk go types - allowing consumers to use the GrafanaAPIHandler interface.
// This allows consumers to use the GrafanaAPIHandler interface which uses sdk types instead of
// the generated protobuf types. SDK requests are turned into protobuf requests, and the protobuf responses are turned
// into SDK responses. Note: (This is a mirror of the converion that happens on the TransformHandler).
type grafanaAPIWrapper struct {
	api GrafanaAPI
}

func (w *grafanaAPIWrapper) QueryDatasource(ctx context.Context, orgID int64, datasourceID int64, tr datasource.TimeRange, queries []datasource.Query) ([]datasource.DatasourceQueryResult, error) {
	// Create protobuf requests from SDK requests
	rawQueries := make([]*pluginv2.DatasourceQuery, 0, len(queries))

	for _, q := range queries {
		rawQueries = append(rawQueries, &pluginv2.DatasourceQuery{
			RefId:         q.RefID,
			MaxDataPoints: q.MaxDataPoints,
			IntervalMs:    q.Interval.Milliseconds(),
			ModelJson:     string(q.ModelJSON),
		})
	}

	rawResp, err := w.api.QueryDatasource(ctx, &pluginv2.QueryDatasourceRequest{
		OrgId:        orgID,
		DatasourceId: datasourceID,
		TimeRange: &pluginv2.TimeRange{
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

	// Convert protobuf responses to SDK responses
	results := make([]datasource.DatasourceQueryResult, len(rawResp.GetResults()))

	for resIdx, rawRes := range rawResp.GetResults() {
		// TODO Error property etc
		dfs := make([]*dataframe.Frame, len(rawRes.Dataframes))
		for dfIdx, b := range rawRes.Dataframes {
			dfs[dfIdx], err = dataframe.UnMarshalArrow(b)
			if err != nil {
				return nil, err
			}
		}
		results[resIdx] = datasource.DatasourceQueryResult{
			DataFrames: dfs,
		}
	}

	return results, nil
}
