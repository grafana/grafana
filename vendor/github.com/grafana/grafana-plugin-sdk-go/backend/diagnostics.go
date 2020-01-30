package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// DiagnosticsPlugin is the Grafana diagnostics plugin interface.
type DiagnosticsPlugin interface {
	CollectMetrics(ctx context.Context, req *pluginv2.CollectMetrics_Request) (*pluginv2.CollectMetrics_Response, error)
	CheckHealth(ctx context.Context, req *pluginv2.CheckHealth_Request) (*pluginv2.CheckHealth_Response, error)
}

type CheckHealthHandler interface {
	CheckHealth(ctx context.Context) (*CheckHealthResult, error)
}

// HealthStatus is the status of the plugin.
type HealthStatus int

const (
	// HealthStatusUnknown means the status of the plugin is unknown.
	HealthStatusUnknown HealthStatus = iota
	// HealthStatusOk means the status of the plugin is good.
	HealthStatusOk
	// HealthStatusError means the plugin is in an error state.
	HealthStatusError
)

func (ps HealthStatus) toProtobuf() pluginv2.CheckHealth_Response_HealthStatus {
	switch ps {
	case HealthStatusUnknown:
		return pluginv2.CheckHealth_Response_UNKNOWN
	case HealthStatusOk:
		return pluginv2.CheckHealth_Response_OK
	case HealthStatusError:
		return pluginv2.CheckHealth_Response_ERROR
	}
	panic("unsupported protobuf health status type in sdk")
}

type CheckHealthResult struct {
	Status HealthStatus
	Info   string
}

func (res *CheckHealthResult) toProtobuf() *pluginv2.CheckHealth_Response {
	return &pluginv2.CheckHealth_Response{
		Status: res.Status.toProtobuf(),
		Info:   res.Info,
	}
}
