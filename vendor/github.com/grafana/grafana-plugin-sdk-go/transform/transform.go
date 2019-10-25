package transform

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/datasource"
	pdatasource "github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
	ptrans "github.com/grafana/grafana-plugin-sdk-go/genproto/transform"
	"github.com/hashicorp/go-plugin"
)

// TransformHandler handles data source queries.
// Note: Arguments are sdk.Datasource objects
type TransformHandler interface {
	Query(ctx context.Context, tr datasource.TimeRange, ds datasource.DataSourceInfo, queries []datasource.Query, api GrafanaAPIHandler) ([]datasource.QueryResult, error)
}

// transformPluginWrapper converts protobuf types to sdk go types - allowing consumers to use the TransformHandler interface.
type transformPluginWrapper struct {
	plugin.NetRPCUnsupportedPlugin

	handler TransformHandler
}

// GrafanaAPIHandler handles querying other data sources from the transform plugin.
type GrafanaAPIHandler interface {
	QueryDatasource(ctx context.Context, orgID int64, datasourceID int64, tr datasource.TimeRange, queries []datasource.Query) ([]datasource.DatasourceQueryResult, error)
}

// GrafanaAPI is the Grafana API interface that allows a datasource plugin to callback and request additional information from Grafana.
type GrafanaAPI interface {
	QueryDatasource(ctx context.Context, req *ptrans.QueryDatasourceRequest) (*ptrans.QueryDatasourceResponse, error)
}

// grafanaAPIWrapper converts protobuf types to sdk go types - allowing consumers to use the GrafanaAPIHandler interface.
type grafanaAPIWrapper struct {
	api GrafanaAPI
}

func (p *transformPluginWrapper) Query(ctx context.Context, req *pdatasource.DatasourceRequest, api GrafanaAPI) (*pdatasource.DatasourceResponse, error) {
	tr := datasource.TimeRange{
		From: time.Unix(0, req.TimeRange.FromEpochMs*int64(time.Millisecond)),
		To:   time.Unix(0, req.TimeRange.ToEpochMs*int64(time.Millisecond)),
	}

	dsi := datasource.DataSourceInfo{
		ID:       req.Datasource.Id,
		OrgID:    req.Datasource.OrgId,
		Name:     req.Datasource.Name,
		Type:     req.Datasource.Type,
		URL:      req.Datasource.Url,
		JSONData: json.RawMessage(req.Datasource.JsonData),
	}

	var queries []datasource.Query
	for _, q := range req.Queries {
		queries = append(queries, datasource.Query{
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
		return &pdatasource.DatasourceResponse{
			Results: []*pdatasource.QueryResult{},
		}, nil
	}

	var respResults []*pdatasource.QueryResult

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

		queryResult := &pdatasource.QueryResult{
			Error:      res.Error,
			RefId:      res.RefID,
			MetaJson:   res.MetaJSON,
			Dataframes: encodedFrames,
		}

		respResults = append(respResults, queryResult)
	}

	return &pdatasource.DatasourceResponse{
		Results: respResults,
	}, nil
}

func (w *grafanaAPIWrapper) QueryDatasource(ctx context.Context, orgID int64, datasourceID int64, tr datasource.TimeRange, queries []datasource.Query) ([]datasource.DatasourceQueryResult, error) {
	rawQueries := make([]*pdatasource.Query, 0, len(queries))

	for _, q := range queries {
		rawQueries = append(rawQueries, &pdatasource.Query{
			RefId:         q.RefID,
			MaxDataPoints: q.MaxDataPoints,
			IntervalMs:    q.Interval.Milliseconds(),
			ModelJson:     string(q.ModelJSON),
		})
	}

	rawResp, err := w.api.QueryDatasource(ctx, &ptrans.QueryDatasourceRequest{
		OrgId:        orgID,
		DatasourceId: datasourceID,
		TimeRange: &pdatasource.TimeRange{
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
