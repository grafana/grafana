package sqlds

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type HealthChecker struct {
	Connector       *Connector
	Metrics         Metrics
	PreCheckHealth  func(ctx context.Context, req *backend.CheckHealthRequest) *backend.CheckHealthResult
	PostCheckHealth func(ctx context.Context, req *backend.CheckHealthRequest) *backend.CheckHealthResult
}

func (hc *HealthChecker) Check(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	start := time.Now()
	if hc.PreCheckHealth != nil {
		if res := hc.PreCheckHealth(ctx, req); res != nil && res.Status == backend.HealthStatusError {
			hc.Metrics.CollectDuration(SourceDownstream, StatusError, time.Since(start).Seconds())
			return res, nil
		}
	}
	if _, err := hc.Connector.Connect(ctx, req.GetHTTPHeaders()); err != nil {
		hc.Metrics.CollectDuration(SourceDownstream, StatusError, time.Since(start).Seconds())
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}
	if hc.PostCheckHealth != nil {
		if res := hc.PostCheckHealth(ctx, req); res != nil && res.Status == backend.HealthStatusError {
			hc.Metrics.CollectDuration(SourceDownstream, StatusError, time.Since(start).Seconds())
			return res, nil
		}
	}
	hc.Metrics.CollectDuration(SourceDownstream, StatusOK, time.Since(start).Seconds())
	return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Data source is working"}, nil
}
