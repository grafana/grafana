package v1

import (
	"context"
	"net/url"
	"path"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// Notifier is responsible for sending
// alert notifications over email.
type Notifier struct {
	*receivers.Base
	ns       receivers.EmailSender
	images   images.Provider
	tmpl     *templates.Template
	settings Config
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.EmailSender, images images.Provider, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		ns:       sender,
		images:   images,
		tmpl:     template,
		settings: cfg,
	}
}

// Notify sends the alert notification.
func (en *Notifier) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	l := en.GetLogger(ctx)
	var tmplErr error
	tmpl, data := templates.TmplText(ctx, en.tmpl, alerts, l, &tmplErr)

	subject := tmpl(en.settings.Subject)
	alertPageURL := en.tmpl.ExternalURL.String()
	ruleURL := en.tmpl.ExternalURL.String()
	u, err := url.Parse(en.tmpl.ExternalURL.String())
	if err == nil {
		basePath := u.Path
		u.Path = path.Join(basePath, "/alerting/list")
		ruleURL = u.String()
		u.RawQuery = "alertState=firing&view=state"
		alertPageURL = u.String()
	} else {
		level.Debug(l).Log("msg", "failed to parse external URL", "url", en.tmpl.ExternalURL.String(), "err", err.Error())
	}

	seenContent := make(map[string]string)
	// Extend alerts data with images, if available.
	embeddedContents := make([]receivers.EmbeddedContent, 0)
	err = images.WithStoredImages(ctx, l, en.images,
		func(index int, image images.Image) error {
			if image.HasURL() {
				data.Alerts[index].ImageURL = image.URL
			} else {
				if name, ok := seenContent[image.ID]; ok && image.ID != "" { // If ID is not specified, do not deduplicate.
					data.Alerts[index].EmbeddedImage = name
					// Don't add the same image twice.
					return nil
				}
				if contents, err := image.RawData(ctx); err == nil {
					data.Alerts[index].EmbeddedImage = contents.Name
					embeddedContents = append(embeddedContents, receivers.EmbeddedContent{
						Name:    contents.Name,
						Content: contents.Content,
					})
					seenContent[image.ID] = contents.Name
				} else {
					level.Warn(l).Log("msg", "failed to get image file for email attachment", "alert", alerts[index].String(), "err", err)
				}
			}
			return nil
		}, alerts...)
	if err != nil {
		level.Warn(l).Log("msg", "failed to get all images for email", "err", err)
	}

	cmd := &receivers.SendEmailSettings{
		Subject: subject,
		Data: map[string]interface{}{
			"Title":             subject,
			"Message":           tmpl(en.settings.Message),
			"Status":            data.Status,
			"Alerts":            data.Alerts,
			"GroupLabels":       data.GroupLabels,
			"CommonLabels":      data.CommonLabels,
			"CommonAnnotations": data.CommonAnnotations,
			"ExternalURL":       data.ExternalURL,
			"RuleUrl":           ruleURL,
			"AlertPageUrl":      alertPageURL,
		},
		EmbeddedContents: embeddedContents,
		To:               en.settings.Addresses,
		SingleEmail:      en.settings.SingleEmail,
		Template:         "ng_alert_notification",
	}

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template email message", "err", tmplErr.Error())
	}

	if err := en.ns.SendEmail(ctx, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func (en *Notifier) SendResolved() bool {
	return !en.GetDisableResolveMessage()
}
