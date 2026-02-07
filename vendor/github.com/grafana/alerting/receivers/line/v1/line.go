package v1

import (
	"context"
	"fmt"
	"net/url"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

var (
	// APIURL of where the notification payload is sent. It is public to be overridable in integration tests.
	// API document link: https://notify-bot.line.me/doc/en/
	APIURL = "https://notify-api.line.me/api/notify"
)

// LINE Notify supports 1000 chars max - from https://notify-bot.line.me/doc/en/
const lineMaxMessageLenRunes = 1000

// Notifier is responsible for sending
// alert notifications to LINE.
type Notifier struct {
	*receivers.Base
	ns       receivers.WebhookSender
	tmpl     *templates.Template
	settings Config
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		ns:       sender,
		tmpl:     template,
		settings: cfg,
	}
}

// Notify send an alert notification to LINE
func (ln *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := ln.GetLogger(ctx)
	level.Debug(l).Log("msg", "executing notification")
	body, err := ln.buildLineMessage(ctx, l, as...)
	if err != nil {
		return false, fmt.Errorf("failed to build message: %w", err)
	}

	form := url.Values{}
	form.Add("message", body)

	cmd := &receivers.SendWebhookSettings{
		URL:        APIURL,
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", ln.settings.Token),
			"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		},
		Body: form.Encode(),
	}

	if err := ln.ns.SendWebhook(ctx, l, cmd); err != nil {
		level.Error(l).Log("msg", "failed to send notification to LINE", "err", err, "body", body)
		return false, err
	}

	return true, nil
}

func (ln *Notifier) SendResolved() bool {
	return !ln.GetDisableResolveMessage()
}

func (ln *Notifier) buildLineMessage(ctx context.Context, l log.Logger, as ...*types.Alert) (string, error) {
	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, ln.tmpl, as, l, &tmplErr)

	body := fmt.Sprintf(
		"%s\n%s",
		tmpl(ln.settings.Title),
		tmpl(ln.settings.Description),
	)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Line message", "err", tmplErr.Error())
	}

	message, truncated := receivers.TruncateInRunes(body, lineMaxMessageLenRunes)
	if truncated {
		key, err := notify.ExtractGroupKey(ctx)
		if err != nil {
			return "", err
		}
		level.Warn(l).Log("msg", "Truncated message", "alert", key, "max_runes", lineMaxMessageLenRunes)
	}
	return message, nil
}
