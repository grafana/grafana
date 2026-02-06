package v1

import (
	"context"
	"fmt"
	"net/url"
	"path"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

var (
	// APIURL of where the notification payload is sent. It is public to be overridable in integration tests.
	APIURL = "https://msgapi.threema.ch/send_simple"
)

// Notifier is responsible for sending
// alert notifications to Threema.
type Notifier struct {
	*receivers.Base
	images   images.Provider
	ns       receivers.WebhookSender
	tmpl     *templates.Template
	settings Config
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		images:   images,
		ns:       sender,
		tmpl:     template,
		settings: cfg,
	}
}

// Notify send an alert notification to Threema
func (tn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := tn.GetLogger(ctx)
	level.Debug(l).Log("msg", "sending threema alert notification", "from", tn.settings.GatewayID, "to", tn.settings.RecipientID)

	// Set up basic API request data
	data := url.Values{}
	data.Set("from", tn.settings.GatewayID)
	data.Set("to", tn.settings.RecipientID)
	data.Set("secret", tn.settings.APISecret)
	data.Set("text", tn.buildMessage(ctx, l, as...))

	cmd := &receivers.SendWebhookSettings{
		URL:        APIURL,
		Body:       data.Encode(),
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
		},
	}
	if err := tn.ns.SendWebhook(ctx, l, cmd); err != nil {
		level.Error(l).Log("msg", "Failed to send threema notification", "err", err)
		return false, err
	}

	return true, nil
}

func (tn *Notifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}

func (tn *Notifier) buildMessage(ctx context.Context, l log.Logger, as ...*types.Alert) string {
	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, tn.tmpl, as, l, &tmplErr)

	message := fmt.Sprintf("%s%s\n\n*Message:*\n%s\n*URL:* %s\n",
		selectEmoji(as...),
		tmpl(tn.settings.Title),
		tmpl(tn.settings.Description),
		path.Join(tn.tmpl.ExternalURL.String(), "/alerting/list"),
	)

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Threema message", "err", tmplErr.Error())
	}

	_ = images.WithStoredImages(ctx, l, tn.images,
		func(_ int, image images.Image) error {
			if image.URL != "" {
				message += fmt.Sprintf("*Image:* %s\n", image.URL)
			}
			return nil
		}, as...)

	return message
}

func selectEmoji(as ...*types.Alert) string {
	if types.Alerts(as...).Status() == model.AlertResolved {
		return "\u2705 " // Check Mark Button
	}
	return "\u26A0\uFE0F " // Warning sign
}
