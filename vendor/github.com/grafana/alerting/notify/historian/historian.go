package historian

import (
	"context"
	"encoding/json"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	prometheusModel "github.com/prometheus/common/model"
	"go.opentelemetry.io/otel/trace"

	alertingInstrument "github.com/grafana/alerting/http/instrument"
	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/grafana/alerting/notify/nfstatus"
)

const (
	LokiClientSpanName              = "ngalert.notification-historian.client"
	NotificationHistoryWriteTimeout = time.Minute
	LabelFrom                       = "from"
	LabelFromValue                  = "notify-history"
)

type NotificationHistoryLokiEntry struct {
	SchemaVersion int                               `json:"schemaVersion"`
	Receiver      string                            `json:"receiver"`
	GroupKey      string                            `json:"groupKey"`
	Status        string                            `json:"status"`
	GroupLabels   map[string]string                 `json:"groupLabels"`
	Alert         NotificationHistoryLokiEntryAlert `json:"alert"`
	AlertIndex    int                               `json:"alertIndex"`
	AlertCount    int                               `json:"alertCount"`
	Retry         bool                              `json:"retry"`
	Error         string                            `json:"error,omitempty"`
	Duration      int64                             `json:"duration"`
	PipelineTime  time.Time                         `json:"pipelineTime"`
}

type NotificationHistoryLokiEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
	ExtraData   json.RawMessage   `json:"enrichments,omitempty"`
}

type remoteLokiClient interface {
	Ping(context.Context) error
	Push(context.Context, []lokiclient.Stream) error
}

type NotificationHistorian struct {
	client         remoteLokiClient
	externalLabels map[string]string
	writesTotal    prometheus.Counter
	writesFailed   prometheus.Counter
	logger         log.Logger
}

func NewNotificationHistorian(
	logger log.Logger,
	cfg lokiclient.LokiConfig,
	req alertingInstrument.Requester,
	bytesWritten prometheus.Counter,
	writeDuration *instrument.HistogramCollector,
	writesTotal prometheus.Counter,
	writesFailed prometheus.Counter,
	tracer trace.Tracer,
) *NotificationHistorian {
	return &NotificationHistorian{
		client:         lokiclient.NewLokiClient(cfg, req, bytesWritten, writeDuration, logger, tracer, LokiClientSpanName),
		externalLabels: cfg.ExternalLabels,
		writesTotal:    writesTotal,
		writesFailed:   writesFailed,
		logger:         logger,
	}
}

func (h *NotificationHistorian) TestConnection(ctx context.Context) error {
	return h.client.Ping(ctx)
}

func (h *NotificationHistorian) Record(ctx context.Context, nhe nfstatus.NotificationHistoryEntry) {
	stream, err := h.prepareStream(nhe)
	if err != nil {
		level.Error(h.logger).Log("msg", "Failed to convert notification history to streams", "error", err)
		return
	}

	// This is a new background job, so let's create a new context for it.
	// We want it to be isolated, i.e. we don't want grafana shutdowns to interrupt this work
	// immediately but rather try to flush writes.
	// This also prevents timeouts or other lingering objects (like transactions) from being
	// incorrectly propagated here from other areas.
	writeCtx, cancel := context.WithTimeout(context.Background(), NotificationHistoryWriteTimeout)
	writeCtx = trace.ContextWithSpan(writeCtx, trace.SpanFromContext(ctx))
	defer cancel()

	level.Debug(h.logger).Log("msg", "Saving notification history")
	h.writesTotal.Inc()

	if err := h.client.Push(writeCtx, []lokiclient.Stream{stream}); err != nil {
		level.Error(h.logger).Log("msg", "Failed to save notification history", "error", err)
		h.writesFailed.Inc()
	}
	level.Debug(h.logger).Log("msg", "Done saving notification history")
}

func (h *NotificationHistorian) prepareStream(nhe nfstatus.NotificationHistoryEntry) (lokiclient.Stream, error) {
	now := time.Now()
	entryAlerts := make([]NotificationHistoryLokiEntryAlert, len(nhe.Alerts))
	for i, alert := range nhe.Alerts {
		labels := prepareLabels(alert.Labels)
		annotations := prepareLabels(alert.Annotations)
		entryAlerts[i] = NotificationHistoryLokiEntryAlert{
			Labels:      labels,
			Annotations: annotations,
			Status:      string(alert.StatusAt(now)),
			StartsAt:    alert.StartsAt,
			EndsAt:      alert.EndsAt,
			ExtraData:   alert.ExtraData,
		}
	}

	notificationErrStr := ""
	if nhe.NotificationErr != nil {
		notificationErrStr = nhe.NotificationErr.Error()
	}

	as := make([]*types.Alert, len(nhe.Alerts))
	for i := range nhe.Alerts {
		as[i] = nhe.Alerts[i].Alert
	}

	values := make([]lokiclient.Sample, len(nhe.Alerts))
	for i := range nhe.Alerts {
		entry := NotificationHistoryLokiEntry{
			SchemaVersion: 1,
			Receiver:      nhe.ReceiverName,
			Status:        string(types.Alerts(as...).StatusAt(now)),
			GroupKey:      nhe.GroupKey,
			GroupLabels:   prepareLabels(nhe.GroupLabels),
			Alert:         entryAlerts[i],
			AlertIndex:    i,
			AlertCount:    len(nhe.Alerts),
			Retry:         nhe.Retry,
			Error:         notificationErrStr,
			Duration:      int64(nhe.Duration),
			PipelineTime:  nhe.PipelineTime,
		}

		entryJSON, err := json.Marshal(entry)
		if err != nil {
			return lokiclient.Stream{}, err
		}

		values[i] = lokiclient.Sample{
			T: now,
			V: string(entryJSON),
		}
	}

	streamLabels := make(map[string]string)
	streamLabels[LabelFrom] = LabelFromValue

	for k, v := range h.externalLabels {
		streamLabels[k] = v
	}

	return lokiclient.Stream{
		Stream: streamLabels,
		Values: values,
	}, nil
}

func prepareLabels(labels prometheusModel.LabelSet) map[string]string {
	result := make(map[string]string, len(labels))
	for k, v := range labels {
		result[string(k)] = string(v)
	}
	return result
}
