package v1

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// Notifier is responsible for sending
// alert notifications as webhooks.
type Notifier struct {
	*receivers.Base
	ns       receivers.WebhookSender
	images   images.Provider
	tmpl     *templates.Template
	orgID    int64
	settings Config
}

// New is the constructor for
// the WebHook notifier.
func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger, orgID int64) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		orgID:    orgID,
		ns:       sender,
		images:   images,
		tmpl:     template,
		settings: cfg,
	}
}

// webhookMessage defines the JSON object send to webhook endpoints.
type webhookMessage struct {
	*templates.ExtendedData

	// The protocol version.
	Version         string `json:"version"`
	GroupKey        string `json:"groupKey"`
	TruncatedAlerts int    `json:"truncatedAlerts"`
	OrgID           int64  `json:"orgId"`
	Title           string `json:"title"`
	State           string `json:"state"`
	Message         string `json:"message"`
}

// Notify implements the Notifier interface.
func (wn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := wn.GetLogger(ctx)
	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	as, numTruncated := truncateAlerts(wn.settings.MaxAlerts, as)
	var tmplErr error
	tmpl, data := templates.TmplText(ctx, wn.tmpl, as, l, &tmplErr)
	data.TruncatedAlerts = &numTruncated

	// Fail early if we can't template the URL.
	parsedURL := tmpl(wn.settings.URL)
	if tmplErr != nil {
		return false, tmplErr
	}

	// Augment our Alert data with ImageURLs if available.
	_ = images.WithStoredImages(ctx, l, wn.images,
		func(index int, image images.Image) error {
			if len(image.URL) != 0 {
				data.Alerts[index].ImageURL = image.URL
			}
			return nil
		},
		as...)

	state := string(receivers.AlertStateOK)
	if types.Alerts(as...).Status() == model.AlertFiring {
		state = string(receivers.AlertStateAlerting)
	}

	// Augment extended Alert data with any extra data if provided
	// If there is no extra data in the context or it is malformed,
	// we simply continue without erroring
	extraData, ok := receivers.GetExtraDataFromContext(ctx)
	if ok && len(data.Alerts) == len(extraData) {
		for i, ed := range extraData {
			data.Alerts[i].ExtraData = ed
		}
	}

	// Provide variables to the template for use in the custom payload.
	for k, v := range wn.settings.Payload.Vars {
		data.Vars[k] = v
	}

	var body string
	if wn.settings.Payload.Template != "" {
		body = tmpl(wn.settings.Payload.Template)
		if tmplErr != nil {
			return false, tmplErr // TODO: Should there be an option to fallback to the default payload?
		}
	} else {
		// We separate templating the Title and Message so we can capture any errors and reset the error state.
		// Otherwise, if Title fails Message will not be templated either.
		title := tmpl(wn.settings.Title)
		if tmplErr != nil {
			level.Warn(l).Log("msg", "failed to template webhook title", "err", tmplErr.Error())
			tmplErr = nil // Reset the error for the next template.
		}
		message := tmpl(wn.settings.Message)
		if tmplErr != nil {
			level.Warn(l).Log("msg", "failed to template webhook message", "err", tmplErr.Error())
			tmplErr = nil // Reset the error for the next template.
		}
		payload, err := json.Marshal(webhookMessage{
			Version:         "1",
			ExtendedData:    data,
			GroupKey:        groupKey.String(),
			TruncatedAlerts: numTruncated,
			OrgID:           wn.orgID,
			State:           state,
			Title:           title,
			Message:         message,
		})
		if err != nil {
			return false, err
		}

		body = string(payload)
	}

	headers, removed := OmitRestrictedHeaders(wn.settings.ExtraHeaders)
	if len(removed) > 0 {
		level.Debug(l).Log("msg", "removed restricted headers", "headers", removed)
	}

	if wn.settings.AuthorizationScheme != "" && wn.settings.AuthorizationCredentials != "" {
		headers["Authorization"] = fmt.Sprintf("%s %s", wn.settings.AuthorizationScheme, wn.settings.AuthorizationCredentials)
	}

	var tlsConfig *tls.Config
	if wn.settings.TLSConfig != nil {
		if tlsConfig, err = wn.settings.TLSConfig.ToCryptoTLSConfig(); err != nil {
			return false, err
		}
	}

	if parsedURL == NoopURL {
		level.Debug(l).Log("msg", "skipping webhook notification, URL is set to noop")
		return true, nil
	}

	cmd := &receivers.SendWebhookSettings{
		URL:        parsedURL,
		User:       wn.settings.User,
		Password:   wn.settings.Password,
		Body:       body,
		HTTPMethod: wn.settings.HTTPMethod,
		HTTPHeader: headers,
		TLSConfig:  tlsConfig,
		HMACConfig: wn.settings.HMACConfig,
	}

	if err := wn.ns.SendWebhook(ctx, l, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func truncateAlerts(maxAlerts int, alerts []*types.Alert) ([]*types.Alert, int) {
	if maxAlerts > 0 && len(alerts) > maxAlerts {
		return alerts[:maxAlerts], len(alerts) - maxAlerts
	}

	return alerts, 0
}

func (wn *Notifier) SendResolved() bool {
	return !wn.GetDisableResolveMessage()
}
