package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// Notifier is responsible for sending alert notifications as webex messages.
type Notifier struct {
	*receivers.Base
	ns       receivers.WebhookSender
	images   images.Provider
	tmpl     *templates.Template
	orgID    int64
	settings Config
}

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

// webexMessage defines the JSON object to send to Webex endpoints.
type webexMessage struct {
	RoomID  string   `json:"roomId,omitempty"`
	Message string   `json:"markdown"`
	Files   []string `json:"files,omitempty"`
}

// Notify implements the Notifier interface.
func (wn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := wn.GetLogger(ctx)
	var tmplErr error
	tmpl, data := templates.TmplText(ctx, wn.tmpl, as, l, &tmplErr)

	message, truncated := receivers.TruncateInBytes(tmpl(wn.settings.Message), 4096)
	if truncated {
		level.Warn(l).Log("msg", "Webex message too long, truncating message", "originalMessage", wn.settings.Message)
	}

	if tmplErr != nil {
		level.Warn(l).Log("msg", "Failed to template webex message", "err", tmplErr.Error())
		tmplErr = nil
	}

	msg := &webexMessage{
		RoomID:  wn.settings.RoomID,
		Message: message,
		Files:   []string{},
	}

	// Augment our Alert data with ImageURLs if available.
	_ = images.WithStoredImages(ctx, l, wn.images, func(index int, image images.Image) error {
		// Cisco Webex only supports a single image per request: https://developer.webex.com/docs/basics#message-attachments
		if image.HasURL() {
			data.Alerts[index].ImageURL = image.URL
			msg.Files = append(msg.Files, image.URL)
			return images.ErrImagesDone
		}

		return nil
	}, as...)

	body, err := json.Marshal(msg)
	if err != nil {
		return false, err
	}

	parsedURL := tmpl(wn.settings.APIURL)
	if tmplErr != nil {
		return false, tmplErr
	}

	cmd := &receivers.SendWebhookSettings{
		URL:        parsedURL,
		Body:       string(body),
		HTTPMethod: http.MethodPost,
	}

	if wn.settings.Token != "" {
		headers := make(map[string]string)
		headers["Authorization"] = fmt.Sprintf("Bearer %s", wn.settings.Token)
		cmd.HTTPHeader = headers
	}

	if err := wn.ns.SendWebhook(ctx, l, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func (wn *Notifier) SendResolved() bool {
	return !wn.GetDisableResolveMessage()
}
