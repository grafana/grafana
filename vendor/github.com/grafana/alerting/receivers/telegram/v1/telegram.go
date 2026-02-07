package v1

import (
	"bytes"
	"context"
	"fmt"
	"mime/multipart"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

var (
	// APIURL of where the notification payload is sent. It is public to be overridable in integration tests.
	APIURL = "https://api.telegram.org/bot%s/%s"
)

// Telegram supports 4096 chars max - from https://limits.tginfo.me/en.
const telegramMaxMessageLenRunes = 4096

// Notifier is responsible for sending
// alert notifications to Telegram.
// It uses two API endpoints
// - https://core.telegram.org/bots/api#sendphoto for sending images (only if alerts contain references to them)
// - https://core.telegram.org/bots/api#sendmessage for sending text message
type Notifier struct {
	*receivers.Base
	images   images.Provider
	ns       receivers.WebhookSender
	tmpl     *templates.Template
	settings Config
}

// New is the constructor for the Telegram notifier
func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		tmpl:     template,
		images:   images,
		ns:       sender,
		settings: cfg,
	}
}

// Notify send an alert notification to Telegram.
func (tn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := tn.GetLogger(ctx)
	// Create the cmd for sendMessage
	cmd, err := tn.newWebhookSyncCmd("sendMessage", func(w *multipart.Writer) error {
		msg, err := tn.buildTelegramMessage(ctx, as, l)
		if err != nil {
			return fmt.Errorf("failed to build message: %w", err)
		}
		for k, v := range msg {
			if err := w.WriteField(k, v); err != nil {
				return fmt.Errorf("failed to create form field: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return false, fmt.Errorf("failed to create telegram message: %w", err)
	}
	if err := tn.ns.SendWebhook(ctx, l, cmd); err != nil {
		return false, fmt.Errorf("failed to send telegram message: %w", err)
	}

	// Create the cmd to upload each image
	uploadedImages := make(map[string]struct{})
	_ = images.WithStoredImages(ctx, l, tn.images, func(_ int, image images.Image) error {
		if _, ok := uploadedImages[image.ID]; ok && image.ID != "" { // Do not deduplicate if ID is not specified.
			return nil
		}
		cmd, err = tn.newWebhookSyncCmd("sendPhoto", func(w *multipart.Writer) error {
			f, err := image.RawData(ctx)
			if err != nil {
				return fmt.Errorf("failed to open image: %w", err)
			}
			fw, err := w.CreateFormFile("photo", f.Name)
			if err != nil {
				return fmt.Errorf("failed to create form file: %w", err)
			}
			if _, err := fw.Write(f.Content); err != nil {
				return fmt.Errorf("failed to write to form file: %w", err)
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to create image: %w", err)
		}
		if err := tn.ns.SendWebhook(ctx, l, cmd); err != nil {
			return fmt.Errorf("failed to upload image to telegram: %w", err)
		}
		uploadedImages[image.ID] = struct{}{}
		return nil
	}, as...)

	return true, nil
}

func (tn *Notifier) buildTelegramMessage(ctx context.Context, as []*types.Alert, l log.Logger) (map[string]string, error) {
	var tmplErr error
	defer func() {
		if tmplErr != nil {
			level.Warn(l).Log("msg", "failed to template Telegram message", "err", tmplErr)
		}
	}()

	tmpl, _ := templates.TmplText(ctx, tn.tmpl, as, l, &tmplErr)
	// Telegram supports 4096 chars max
	messageText, truncated := receivers.TruncateInRunes(tmpl(tn.settings.Message), telegramMaxMessageLenRunes)
	if truncated {
		key, err := notify.ExtractGroupKey(ctx)
		if err != nil {
			return nil, err
		}
		level.Warn(l).Log("msg", "Truncated message", "alert", key, "max_runes", telegramMaxMessageLenRunes)
	}

	m := make(map[string]string)
	m["text"] = messageText
	if tn.settings.ParseMode != "" {
		m["parse_mode"] = tn.settings.ParseMode
	}
	if tn.settings.DisableWebPagePreview {
		m["disable_web_page_preview"] = "true"
	}
	if tn.settings.ProtectContent {
		m["protect_content"] = "true"
	}
	return m, nil
}

func (tn *Notifier) newWebhookSyncCmd(action string, fn func(writer *multipart.Writer) error) (*receivers.SendWebhookSettings, error) {
	b := bytes.Buffer{}
	w := multipart.NewWriter(&b)

	boundary := receivers.GetBoundary()
	if boundary != "" {
		if err := w.SetBoundary(boundary); err != nil {
			return nil, err
		}
	}

	if err := w.WriteField("chat_id", tn.settings.ChatID); err != nil {
		return nil, err
	}
	if tn.settings.MessageThreadID != "" {
		if err := w.WriteField("message_thread_id", tn.settings.MessageThreadID); err != nil {
			return nil, err
		}
	}
	if tn.settings.DisableNotifications {
		if err := w.WriteField("disable_notification", "true"); err != nil {
			return nil, err
		}
	}

	if err := fn(w); err != nil {
		return nil, err
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart: %w", err)
	}

	cmd := &receivers.SendWebhookSettings{
		URL:        fmt.Sprintf(APIURL, tn.settings.BotToken, action),
		Body:       b.String(),
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Content-Type": w.FormDataContentType(),
		},
	}
	return cmd, nil
}

func (tn *Notifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
