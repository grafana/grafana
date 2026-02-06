package v1

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/notify"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// https://help.victorops.com/knowledge-base/incident-fields-glossary/ - 20480 characters.
const victorOpsMaxMessageLenRunes = 20480

const (
	// victoropsAlertStateRecovery - VictorOps "RECOVERY" message type
	victoropsAlertStateRecovery = "RECOVERY"
)

// Notifier defines URL property for Victorops REST API
// and handles notification process by formatting POST body according to
// Victorops specifications (http://victorops.force.com/knowledgebase/articles/Integration/Alert-Ingestion-API-Documentation/)
type Notifier struct {
	*receivers.Base
	images     images.Provider
	ns         receivers.WebhookSender
	tmpl       *templates.Template
	settings   Config
	appVersion string
}

// New creates an instance of VictoropsNotifier that
// handles posting notifications to Victorops REST API
func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger, appVersion string) *Notifier {
	return &Notifier{
		Base:       receivers.NewBase(meta, logger),
		images:     images,
		ns:         sender,
		tmpl:       template,
		settings:   cfg,
		appVersion: appVersion,
	}
}

// Notify sends notification to Victorops via POST to URL endpoint
func (vn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := vn.GetLogger(ctx)
	level.Debug(l).Log("msg", "sending notification")

	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, vn.tmpl, as, l, &tmplErr)

	messageType := buildMessageType(l, tmpl, vn.settings.MessageType, as...)

	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	stateMessage, truncated := receivers.TruncateInRunes(tmpl(vn.settings.Description), victorOpsMaxMessageLenRunes)
	if truncated {
		level.Warn(l).Log("msg", "truncated stateMessage", "incident", groupKey, "max_runes", victorOpsMaxMessageLenRunes)
	}

	bodyJSON := map[string]interface{}{
		"message_type":        messageType,
		"entity_id":           groupKey.Hash(),
		"entity_display_name": tmpl(vn.settings.Title),
		"timestamp":           time.Now().Unix(),
		"state_message":       stateMessage,
		"monitoring_tool":     "Grafana v" + vn.appVersion,
	}

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to expand message template", "err", tmplErr.Error())
		tmplErr = nil
	}

	_ = images.WithStoredImages(ctx, l, vn.images,
		func(_ int, image images.Image) error {
			if image.URL != "" {
				bodyJSON["image_url"] = image.URL
				return images.ErrImagesDone
			}
			return nil
		}, as...)

	ruleURL := receivers.JoinURLPath(vn.tmpl.ExternalURL.String(), "/alerting/list", l)
	bodyJSON["alert_url"] = ruleURL

	u := tmpl(vn.settings.URL)
	if tmplErr != nil {
		level.Info(l).Log("msg", "failed to expand URL template", "err", tmplErr.Error(), "fallback", vn.settings.URL)
		u = vn.settings.URL
	}

	b, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, err
	}
	cmd := &receivers.SendWebhookSettings{
		URL:  u,
		Body: string(b),
	}

	if err := vn.ns.SendWebhook(ctx, l, cmd); err != nil {
		level.Error(l).Log("msg", "failed to send notification", "err", err)
		return false, err
	}

	return true, nil
}

func (vn *Notifier) SendResolved() bool {
	return !vn.GetDisableResolveMessage()
}

func buildMessageType(l log.Logger, tmpl func(string) string, msgType string, as ...*types.Alert) string {
	if types.Alerts(as...).Status() == model.AlertResolved {
		return victoropsAlertStateRecovery
	}
	if messageType := strings.ToUpper(tmpl(msgType)); messageType != "" {
		return messageType
	}
	level.Warn(l).Log("msg", "expansion of message type template resulted in an empty string. Using fallback", "fallback", DefaultMessageType, "template", msgType)
	return DefaultMessageType
}
