package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/alecthomas/units"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/notify"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

const (
	// https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgx-send-an-alert-event - 1024 characters or runes.
	pagerDutyMaxV2SummaryLenRunes = 1024
	// https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview#size-limits - 512 KB.
	pagerDutyMaxEventSize int = 512000
)

const (
	pagerDutyEventTrigger = "trigger"
	pagerDutyEventResolve = "resolve"
)

var (
	knownSeverity = map[string]struct{}{DefaultSeverity: {}, "error": {}, "warning": {}, "info": {}}
)

// Notifier is responsible for sending
// alert notifications to pagerduty
type Notifier struct {
	*receivers.Base
	tmpl     *templates.Template
	ns       receivers.WebhookSender
	images   images.Provider
	settings Config
}

// New is the constructor for the PagerDuty notifier
func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		ns:       sender,
		images:   images,
		tmpl:     template,
		settings: cfg,
	}
}

// Notify sends an alert notification to PagerDuty
func (pn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := pn.GetLogger(ctx)
	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved && !pn.SendResolved() {
		level.Debug(l).Log("msg", "not sending a trigger to Pagerduty", "status", alerts.Status(), "auto resolve", pn.SendResolved())
		return true, nil
	}

	msg, eventType, err := pn.buildPagerdutyMessage(ctx, alerts, as, l)
	if err != nil {
		return false, fmt.Errorf("build pagerduty message: %w", err)
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(msg); err != nil {
		return false, fmt.Errorf("failed to encode PagerDuty message: %w", err)
	}

	// This payload size check is taken from the original implementation of the notifier in Alertmanager.
	// https://github.com/prometheus/alertmanager/blob/41eb1213bb1c7ce0aa9e6464e297976d9c81cfe5/notify/pagerduty/pagerduty.go#L126-L142
	if buf.Len() > pagerDutyMaxEventSize {
		bufSize := units.MetricBytes(buf.Len()).String()
		maxEventSize := units.MetricBytes(pagerDutyMaxEventSize).String()
		truncatedMsg := fmt.Sprintf("Custom details have been removed because the original event exceeds the maximum size of %s", maxEventSize)
		msg.Payload.CustomDetails = map[string]string{"error": truncatedMsg}
		level.Warn(l).Log("msg", "Truncated details", "maxSize", maxEventSize, "actualSize", bufSize)

		buf.Reset()
		if err := json.NewEncoder(&buf).Encode(msg); err != nil {
			return false, errors.Wrap(err, "failed to encode PagerDuty message")
		}
	}

	level.Info(l).Log("msg", "notifying Pagerduty", "event_type", eventType)
	cmd := &receivers.SendWebhookSettings{
		URL:        pn.settings.URL,
		Body:       buf.String(),
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Content-Type": "application/json",
		},
	}
	if err := pn.ns.SendWebhook(ctx, l, cmd); err != nil {
		return false, fmt.Errorf("send notification to Pagerduty: %w", err)
	}

	return true, nil
}

func (pn *Notifier) buildPagerdutyMessage(ctx context.Context, alerts model.Alerts, as []*types.Alert, l log.Logger) (*pagerDutyMessage, string, error) {
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return nil, "", err
	}

	eventType := pagerDutyEventTrigger
	if alerts.Status() == model.AlertResolved {
		eventType = pagerDutyEventResolve
	}

	var tmplErr error
	tmpl, data := templates.TmplText(ctx, pn.tmpl, as, l, &tmplErr)

	details := make(map[string]string, len(pn.settings.Details))
	for k, v := range pn.settings.Details {
		detail, err := pn.tmpl.ExecuteTextString(v, data)
		if err != nil {
			return nil, "", fmt.Errorf("%q: failed to template %q: %w", k, v, err)
		}
		details[k] = detail
	}

	severity := strings.ToLower(tmpl(pn.settings.Severity))
	if _, ok := knownSeverity[severity]; !ok {
		level.Warn(l).Log("msg", "Severity is not in the list of known values - using default severity", "actualSeverity", severity, "defaultSeverity", DefaultSeverity)
		severity = DefaultSeverity
	}

	msg := &pagerDutyMessage{
		Client:      tmpl(pn.settings.Client),
		ClientURL:   tmpl(pn.settings.ClientURL),
		RoutingKey:  pn.settings.Key,
		EventAction: eventType,
		DedupKey:    key.Hash(),
		Links: []pagerDutyLink{{
			HRef: pn.tmpl.ExternalURL.String(),
			Text: "External URL",
		}},
		Payload: pagerDutyPayload{
			Source:        tmpl(pn.settings.Source),
			Component:     tmpl(pn.settings.Component),
			Summary:       tmpl(pn.settings.Summary),
			Severity:      severity,
			CustomDetails: details,
			Class:         tmpl(pn.settings.Class),
			Group:         tmpl(pn.settings.Group),
		},
	}

	_ = images.WithStoredImages(ctx, l, pn.images,
		func(_ int, image images.Image) error {
			if len(image.URL) != 0 {
				msg.Images = append(msg.Images, pagerDutyImage{Src: image.URL})
			}

			return nil
		},
		as...)

	summary, truncated := receivers.TruncateInRunes(msg.Payload.Summary, pagerDutyMaxV2SummaryLenRunes)
	if truncated {
		level.Warn(l).Log("msg", "Truncated summary", "key", key, "runes", pagerDutyMaxV2SummaryLenRunes)
	}
	msg.Payload.Summary = summary

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template PagerDuty message", "err", tmplErr.Error())
	}

	return msg, eventType, nil
}

func (pn *Notifier) SendResolved() bool {
	return !pn.GetDisableResolveMessage()
}

type pagerDutyMessage struct {
	RoutingKey  string           `json:"routing_key,omitempty"`
	ServiceKey  string           `json:"service_key,omitempty"`
	DedupKey    string           `json:"dedup_key,omitempty"`
	EventAction string           `json:"event_action"`
	Payload     pagerDutyPayload `json:"payload"`
	Client      string           `json:"client,omitempty"`
	ClientURL   string           `json:"client_url,omitempty"`
	Links       []pagerDutyLink  `json:"links,omitempty"`
	Images      []pagerDutyImage `json:"images,omitempty"`
}

type pagerDutyLink struct {
	HRef string `json:"href"`
	Text string `json:"text"`
}

type pagerDutyImage struct {
	Src string `json:"src"`
}

type pagerDutyPayload struct {
	Summary       string            `json:"summary"`
	Source        string            `json:"source"`
	Severity      string            `json:"severity"`
	Class         string            `json:"class,omitempty"`
	Component     string            `json:"component,omitempty"`
	Group         string            `json:"group,omitempty"`
	CustomDetails map[string]string `json:"custom_details,omitempty"`
}
