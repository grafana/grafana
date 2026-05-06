// Copyright 2019 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pagerduty

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/alecthomas/units"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	commoncfg "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

const (
	maxEventSize int = 512000
	// https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTc4-send-a-v1-event - 1024 characters or runes.
	maxV1DescriptionLenRunes = 1024
	// https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgx-send-an-alert-event - 1024 characters or runes.
	maxV2SummaryLenRunes = 1024
)

// Notifier implements a Notifier for PagerDuty notifications.
type Notifier struct {
	conf    *config.PagerdutyConfig
	tmpl    *template.Template
	logger  log.Logger
	apiV1   string // for tests.
	client  *http.Client
	retrier *notify.Retrier
}

// New returns a new PagerDuty notifier.
func New(c *config.PagerdutyConfig, t *template.Template, l log.Logger, httpOpts ...commoncfg.HTTPClientOption) (*Notifier, error) {
	client, err := commoncfg.NewClientFromConfig(*c.HTTPConfig, "pagerduty", httpOpts...)
	if err != nil {
		return nil, err
	}
	n := &Notifier{conf: c, tmpl: t, logger: l, client: client}
	if c.ServiceKey != "" || c.ServiceKeyFile != "" {
		n.apiV1 = "https://events.pagerduty.com/generic/2010-04-15/create_event.json"
		// Retrying can solve the issue on 403 (rate limiting) and 5xx response codes.
		// https://v2.developer.pagerduty.com/docs/trigger-events
		n.retrier = &notify.Retrier{RetryCodes: []int{http.StatusForbidden}, CustomDetailsFunc: errDetails}
	} else {
		// Retrying can solve the issue on 429 (rate limiting) and 5xx response codes.
		// https://v2.developer.pagerduty.com/docs/events-api-v2#api-response-codes--retry-logic
		n.retrier = &notify.Retrier{RetryCodes: []int{http.StatusTooManyRequests}, CustomDetailsFunc: errDetails}
	}
	return n, nil
}

const (
	pagerDutyEventTrigger = "trigger"
	pagerDutyEventResolve = "resolve"
)

type pagerDutyMessage struct {
	RoutingKey  string            `json:"routing_key,omitempty"`
	ServiceKey  string            `json:"service_key,omitempty"`
	DedupKey    string            `json:"dedup_key,omitempty"`
	IncidentKey string            `json:"incident_key,omitempty"`
	EventType   string            `json:"event_type,omitempty"`
	Description string            `json:"description,omitempty"`
	EventAction string            `json:"event_action"`
	Payload     *pagerDutyPayload `json:"payload"`
	Client      string            `json:"client,omitempty"`
	ClientURL   string            `json:"client_url,omitempty"`
	Details     map[string]string `json:"details,omitempty"`
	Images      []pagerDutyImage  `json:"images,omitempty"`
	Links       []pagerDutyLink   `json:"links,omitempty"`
}

type pagerDutyLink struct {
	HRef string `json:"href"`
	Text string `json:"text"`
}

type pagerDutyImage struct {
	Src  string `json:"src"`
	Alt  string `json:"alt"`
	Href string `json:"href"`
}

type pagerDutyPayload struct {
	Summary       string            `json:"summary"`
	Source        string            `json:"source"`
	Severity      string            `json:"severity"`
	Timestamp     string            `json:"timestamp,omitempty"`
	Class         string            `json:"class,omitempty"`
	Component     string            `json:"component,omitempty"`
	Group         string            `json:"group,omitempty"`
	CustomDetails map[string]string `json:"custom_details,omitempty"`
}

func (n *Notifier) encodeMessage(msg *pagerDutyMessage) (bytes.Buffer, error) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(msg); err != nil {
		return buf, fmt.Errorf("failed to encode PagerDuty message: %w", err)
	}

	if buf.Len() > maxEventSize {
		truncatedMsg := fmt.Sprintf("Custom details have been removed because the original event exceeds the maximum size of %s", units.MetricBytes(maxEventSize).String())

		if n.apiV1 != "" {
			msg.Details = map[string]string{"error": truncatedMsg}
		} else {
			msg.Payload.CustomDetails = map[string]string{"error": truncatedMsg}
		}

		warningMsg := fmt.Sprintf("Truncated Details because message of size %s exceeds limit %s", units.MetricBytes(buf.Len()).String(), units.MetricBytes(maxEventSize).String())
		level.Warn(n.logger).Log("msg", warningMsg)

		buf.Reset()
		if err := json.NewEncoder(&buf).Encode(msg); err != nil {
			return buf, fmt.Errorf("failed to encode PagerDuty message: %w", err)
		}
	}

	return buf, nil
}

func (n *Notifier) notifyV1(
	ctx context.Context,
	eventType string,
	key notify.Key,
	data *template.Data,
	details map[string]string,
	as ...*types.Alert,
) (bool, error) {
	var tmplErr error
	tmpl := notify.TmplText(n.tmpl, data, &tmplErr)

	description, truncated := notify.TruncateInRunes(tmpl(n.conf.Description), maxV1DescriptionLenRunes)
	if truncated {
		level.Warn(n.logger).Log("msg", "Truncated description", "key", key, "max_runes", maxV1DescriptionLenRunes)
	}

	serviceKey := string(n.conf.ServiceKey)
	if serviceKey == "" {
		content, fileErr := os.ReadFile(n.conf.ServiceKeyFile)
		if fileErr != nil {
			return false, fmt.Errorf("failed to read service key from file: %w", fileErr)
		}
		serviceKey = strings.TrimSpace(string(content))
	}

	msg := &pagerDutyMessage{
		ServiceKey:  tmpl(serviceKey),
		EventType:   eventType,
		IncidentKey: key.Hash(),
		Description: description,
		Details:     details,
	}

	if eventType == pagerDutyEventTrigger {
		msg.Client = tmpl(n.conf.Client)
		msg.ClientURL = tmpl(n.conf.ClientURL)
	}

	if tmplErr != nil {
		return false, fmt.Errorf("failed to template PagerDuty v1 message: %w", tmplErr)
	}

	// Ensure that the service key isn't empty after templating.
	if msg.ServiceKey == "" {
		return false, errors.New("service key cannot be empty")
	}

	encodedMsg, err := n.encodeMessage(msg)
	if err != nil {
		return false, err
	}

	resp, err := notify.PostJSON(ctx, n.client, n.apiV1, &encodedMsg)
	if err != nil {
		return true, fmt.Errorf("failed to post message to PagerDuty v1: %w", err)
	}
	defer notify.Drain(resp)

	return n.retrier.Check(resp.StatusCode, resp.Body)
}

func (n *Notifier) notifyV2(
	ctx context.Context,
	eventType string,
	key notify.Key,
	data *template.Data,
	details map[string]string,
	as ...*types.Alert,
) (bool, error) {
	var tmplErr error
	tmpl := notify.TmplText(n.tmpl, data, &tmplErr)

	if n.conf.Severity == "" {
		n.conf.Severity = "error"
	}

	summary, truncated := notify.TruncateInRunes(tmpl(n.conf.Description), maxV2SummaryLenRunes)
	if truncated {
		level.Warn(n.logger).Log("msg", "Truncated summary", "key", key, "max_runes", maxV2SummaryLenRunes)
	}

	routingKey := string(n.conf.RoutingKey)
	if routingKey == "" {
		content, fileErr := os.ReadFile(n.conf.RoutingKeyFile)
		if fileErr != nil {
			return false, fmt.Errorf("failed to read routing key from file: %w", fileErr)
		}
		routingKey = strings.TrimSpace(string(content))
	}

	msg := &pagerDutyMessage{
		Client:      tmpl(n.conf.Client),
		ClientURL:   tmpl(n.conf.ClientURL),
		RoutingKey:  tmpl(routingKey),
		EventAction: eventType,
		DedupKey:    key.Hash(),
		Images:      make([]pagerDutyImage, 0, len(n.conf.Images)),
		Links:       make([]pagerDutyLink, 0, len(n.conf.Links)),
		Payload: &pagerDutyPayload{
			Summary:       summary,
			Source:        tmpl(n.conf.Source),
			Severity:      tmpl(n.conf.Severity),
			CustomDetails: details,
			Class:         tmpl(n.conf.Class),
			Component:     tmpl(n.conf.Component),
			Group:         tmpl(n.conf.Group),
		},
	}

	for _, item := range n.conf.Images {
		image := pagerDutyImage{
			Src:  tmpl(item.Src),
			Alt:  tmpl(item.Alt),
			Href: tmpl(item.Href),
		}

		if image.Src != "" {
			msg.Images = append(msg.Images, image)
		}
	}

	for _, item := range n.conf.Links {
		link := pagerDutyLink{
			HRef: tmpl(item.Href),
			Text: tmpl(item.Text),
		}

		if link.HRef != "" {
			msg.Links = append(msg.Links, link)
		}
	}

	if tmplErr != nil {
		return false, fmt.Errorf("failed to template PagerDuty v2 message: %w", tmplErr)
	}

	// Ensure that the routing key isn't empty after templating.
	if msg.RoutingKey == "" {
		return false, errors.New("routing key cannot be empty")
	}

	encodedMsg, err := n.encodeMessage(msg)
	if err != nil {
		return false, err
	}

	resp, err := notify.PostJSON(ctx, n.client, n.conf.URL.String(), &encodedMsg)
	if err != nil {
		return true, fmt.Errorf("failed to post message to PagerDuty: %w", err)
	}
	defer notify.Drain(resp)

	retry, err := n.retrier.Check(resp.StatusCode, resp.Body)
	if err != nil {
		return retry, notify.NewErrorWithReason(notify.GetFailureReasonFromStatusCode(resp.StatusCode), err)
	}
	return retry, err
}

// Notify implements the Notifier interface.
func (n *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	var (
		alerts    = types.Alerts(as...)
		data      = notify.GetTemplateData(ctx, n.tmpl, as, n.logger)
		eventType = pagerDutyEventTrigger
	)
	if alerts.Status() == model.AlertResolved {
		eventType = pagerDutyEventResolve
	}

	level.Debug(n.logger).Log("incident", key, "eventType", eventType)

	details := make(map[string]string, len(n.conf.Details))
	for k, v := range n.conf.Details {
		detail, err := n.tmpl.ExecuteTextString(v, data)
		if err != nil {
			return false, fmt.Errorf("%q: failed to template %q: %w", k, v, err)
		}
		details[k] = detail
	}

	if n.apiV1 != "" {
		return n.notifyV1(ctx, eventType, key, data, details, as...)
	}
	return n.notifyV2(ctx, eventType, key, data, details, as...)
}

func errDetails(status int, body io.Reader) string {
	// See https://v2.developer.pagerduty.com/docs/trigger-events for the v1 events API.
	// See https://v2.developer.pagerduty.com/docs/send-an-event-events-api-v2 for the v2 events API.
	if status != http.StatusBadRequest || body == nil {
		return ""
	}
	var pgr struct {
		Status  string   `json:"status"`
		Message string   `json:"message"`
		Errors  []string `json:"errors"`
	}
	if err := json.NewDecoder(body).Decode(&pgr); err != nil {
		return ""
	}
	return fmt.Sprintf("%s: %s", pgr.Message, strings.Join(pgr.Errors, ","))
}
