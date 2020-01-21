package adapter

import (
	"bytes"
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/expfmt"
)

func (a *SDKAdapter) CollectMetrics(ctx context.Context, protoReq *pluginv2.CollectMetrics_Request) (*pluginv2.CollectMetrics_Response, error) {
	mfs, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	for _, mf := range mfs {
		_, err := expfmt.MetricFamilyToText(&buf, mf)
		if err != nil {
			return nil, err
		}
	}

	return &pluginv2.CollectMetrics_Response{
		Metrics: &pluginv2.CollectMetrics_Payload{
			Prometheus: buf.Bytes(),
		},
	}, nil
}
