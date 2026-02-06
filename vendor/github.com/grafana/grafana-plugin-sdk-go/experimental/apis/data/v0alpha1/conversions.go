package v0alpha1

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

// ToDataSourceQueries returns queries that should be sent to a single datasource
// This will throw an error if the queries reference multiple instances
func ToDataSourceQueries(req QueryDataRequest) ([]backend.DataQuery, *DataSourceRef, error) {
	var dsRef *DataSourceRef
	var tr *backend.TimeRange
	if req.From != "" {
		val := gtime.NewTimeRange(req.From, req.To)
		tr = &backend.TimeRange{
			From: val.GetFromAsTimeUTC(),
			To:   val.GetToAsTimeUTC(),
		}
	}

	queries := []backend.DataQuery{}
	if len(req.Queries) > 0 {
		dsRef := req.Queries[0].Datasource
		for _, generic := range req.Queries {
			if generic.Datasource != nil && dsRef != nil {
				if dsRef.Type != generic.Datasource.Type {
					return queries, dsRef, fmt.Errorf("expect same datasource types")
				}
				if dsRef.UID != generic.Datasource.UID {
					return queries, dsRef, fmt.Errorf("expect same datasource UID")
				}
			}
			q, err := toBackendDataQuery(generic, tr)
			if err != nil {
				return queries, dsRef, err
			}
			queries = append(queries, q)
		}
		return queries, dsRef, nil
	}
	return queries, dsRef, nil
}

// when the time range is specified locally, per query,
// it will appear in the JSON field of backend.DataQuery.
// this can cause problems in certain data source plugins,
// that expect that the `timeRange` field does not exist.
// see https://github.com/grafana/grafana-plugin-sdk-go/issues/1419
// for more info.
// to improve compatibility, we remove it from the json bytes
// NOTE: it will still be available in the `.TimeRange` field
// of `backend.DataQuery`.
const timeRangeKey = "timeRange"

func deleteTimeRangeFromQueryJSON(data []byte) ([]byte, error) {
	var d map[string]any
	err := json.Unmarshal(data, &d)
	if err != nil {
		return nil, err
	}

	_, found := d[timeRangeKey]

	if !found {
		// we can finish here, return the original
		return data, nil
	}

	delete(d, timeRangeKey)

	return json.Marshal(d)
}

// Converts a generic query to a backend one
func toBackendDataQuery(q DataQuery, defaultTimeRange *backend.TimeRange) (backend.DataQuery, error) {
	var err error
	bq := backend.DataQuery{
		RefID:         q.RefID,
		QueryType:     q.QueryType,
		MaxDataPoints: q.MaxDataPoints,
	}

	// Set an explicit time range for the query
	if q.TimeRange != nil {
		tr := gtime.NewTimeRange(q.TimeRange.From, q.TimeRange.To)
		bq.TimeRange = backend.TimeRange{
			From: tr.GetFromAsTimeUTC(),
			To:   tr.GetToAsTimeUTC(),
		}
	} else if defaultTimeRange != nil {
		bq.TimeRange = *defaultTimeRange
	}

	bytes, err := json.Marshal(q)
	if err != nil {
		return bq, err
	}

	// we understand there is a certain inefficiency here
	// with re-marshaling the bytes, we chose this approach
	// for the following reasons:
	// 1. the smallest possible change
	// 2. the request object is small, so the performance
	//    impact should be limited
	// 3. we can implement faster solutions later,
	//    as a purely internal change here, without
	//    affecting anything.
	//
	// the alternative approach would be to directly
	// serialise the v0alpha1.DataQuery structure into JSON
	// without the timeRange field.
	fixedBytes, err := deleteTimeRangeFromQueryJSON(bytes)
	if err != nil {
		return bq, err
	}

	bq.JSON = fixedBytes

	if bq.MaxDataPoints == 0 {
		bq.MaxDataPoints = 100
	}
	if q.IntervalMS > 0 {
		bq.Interval = time.Millisecond * time.Duration(q.IntervalMS)
	} else {
		bq.Interval = time.Second
	}
	return bq, nil
}
