package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"strconv"
	"strings"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/notify"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// Constants and models are set according to the official documentation https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params

type discordEmbedType string

const (
	discordRichEmbed discordEmbedType = "rich"

	discordMaxEmbeds     = 10
	discordMaxMessageLen = 2000
	// https://discord.com/developers/docs/resources/message#embed-object-embed-limits
	discordMaxTitleLen = 256
)

type discordMessage struct {
	Username  string             `json:"username,omitempty"`
	Content   string             `json:"content"`
	AvatarURL string             `json:"avatar_url,omitempty"`
	Embeds    []discordLinkEmbed `json:"embeds,omitempty"`
}

// discordLinkEmbed implements https://discord.com/developers/docs/resources/channel#embed-object
type discordLinkEmbed struct {
	Title string           `json:"title,omitempty"`
	Type  discordEmbedType `json:"type,omitempty"`
	URL   string           `json:"url,omitempty"`
	Color int64            `json:"color,omitempty"`

	Footer *discordFooter `json:"footer,omitempty"`

	Image *discordImage `json:"image,omitempty"`
}

// discordFooter implements https://discord.com/developers/docs/resources/channel#embed-object-embed-footer-structure
type discordFooter struct {
	Text    string `json:"text"`
	IconURL string `json:"icon_url,omitempty"`
}

// discordImage implements https://discord.com/developers/docs/resources/channel#embed-object-embed-footer-structure
type discordImage struct {
	URL string `json:"url"`
}

// discordError implements https://discord.com/developers/docs/reference#error-messages except for Errors field that is not used in the code
type discordError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type Notifier struct {
	*receivers.Base
	ns         receivers.WebhookSender
	images     images.Provider
	tmpl       *templates.Template
	settings   Config
	appVersion string
}

type discordAttachment struct {
	url       string
	content   []byte
	name      string
	alertName string
	state     model.AlertStatus
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger, appVersion string) *Notifier {
	return &Notifier{
		Base:       receivers.NewBase(meta, logger),
		ns:         sender,
		images:     images,
		tmpl:       template,
		settings:   cfg,
		appVersion: appVersion,
	}
}

func (d Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := d.GetLogger(ctx)
	alerts := types.Alerts(as...)

	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	var msg discordMessage

	if !d.settings.UseDiscordUsername {
		msg.Username = "Grafana"
	}

	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, d.tmpl, as, l, &tmplErr)

	msg.Content = tmpl(d.settings.Message)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Discord notification content", "err", tmplErr.Error())
		// Reset tmplErr for templating other fields.
		tmplErr = nil
	}
	truncatedMsg, truncated := receivers.TruncateInRunes(msg.Content, discordMaxMessageLen)
	if truncated {
		level.Warn(l).Log("msg", "Truncated content", "key", key, "max_runes", discordMaxMessageLen)
		msg.Content = truncatedMsg
	}

	if d.settings.AvatarURL != "" {
		msg.AvatarURL = tmpl(d.settings.AvatarURL)
		if tmplErr != nil {
			level.Warn(l).Log("msg", "failed to template Discord Avatar URL", "err", tmplErr.Error(), "fallback", d.settings.AvatarURL)
			msg.AvatarURL = d.settings.AvatarURL
			tmplErr = nil
		}
	}

	footer := &discordFooter{
		Text:    "Grafana v" + d.appVersion,
		IconURL: "https://grafana.com/static/assets/img/fav32.png",
	}

	var linkEmbed discordLinkEmbed

	title := tmpl(d.settings.Title)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Discord notification title", "err", tmplErr.Error())
		// Reset tmplErr for templating other fields.
		tmplErr = nil
	}
	linkEmbed.Title, truncated = receivers.TruncateInRunes(title, discordMaxTitleLen)
	if truncated {
		level.Warn(l).Log("msg", "Truncated title", "key", key, "max_runes", discordMaxTitleLen)
	}

	linkEmbed.Footer = footer
	linkEmbed.Type = discordRichEmbed

	color, _ := strconv.ParseInt(strings.TrimLeft(receivers.GetAlertStatusColor(alerts.Status()), "#"), 16, 0)
	linkEmbed.Color = color

	ruleURL := receivers.JoinURLPath(d.tmpl.ExternalURL.String(), "/alerting/list", l)
	linkEmbed.URL = ruleURL

	embeds := []discordLinkEmbed{linkEmbed}

	attachments := d.constructAttachments(ctx, as, discordMaxEmbeds-1, l)
	for _, a := range attachments {
		embedTitle, truncated := receivers.TruncateInRunes(a.alertName, discordMaxTitleLen)
		if truncated {
			level.Warn(l).Log("msg", "Truncated image embed title", "key", key, "alert", a.alertName, "max_runes", discordMaxTitleLen)
		}

		embed := discordLinkEmbed{
			Image: &discordImage{
				URL: a.url,
			},
			Color: color,
			Title: embedTitle,
		}
		embeds = append(embeds, embed)
	}

	msg.Embeds = embeds

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Discord message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(d.settings.WebhookURL)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Discord URL", "err", tmplErr.Error(), "fallback", d.settings.WebhookURL)
		u = d.settings.WebhookURL
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return false, err
	}

	cmd, err := d.buildRequest(u, body, attachments, l)
	if err != nil {
		return false, err
	}

	cmd.Validation = func(body []byte, statusCode int) error {
		if statusCode/100 != 2 {
			level.Error(l).Log("msg", "failed to send notification to Discord", "statusCode", statusCode, "responseBody", string(body))
			errBody := discordError{}
			if err := json.Unmarshal(body, &errBody); err == nil {
				return fmt.Errorf("the Discord API responded (status %d) with error code %d: %s", statusCode, errBody.Code, errBody.Message)
			}
			return fmt.Errorf("unexpected status code %d from Discord", statusCode)
		}
		return nil
	}
	if err := d.ns.SendWebhook(ctx, l, cmd); err != nil {
		return false, err
	}
	return true, nil
}

func (d Notifier) SendResolved() bool {
	return !d.GetDisableResolveMessage()
}

func (d Notifier) constructAttachments(ctx context.Context, alerts []*types.Alert, embedQuota int, l log.Logger) []*discordAttachment {
	attachments := make([]*discordAttachment, 0, embedQuota)
	seenName := make(map[string]*discordAttachment)
	err := images.WithStoredImages(ctx, l, d.images,
		func(index int, image images.Image) error {
			// Check if the image limit has been reached at the start of each iteration.
			if len(attachments) >= embedQuota {
				level.Warn(l).Log("msg", "Discord embed quota reached, not creating more attachments for this notification", "embedQuota", embedQuota)
				return images.ErrImagesDone
			}

			alert := alerts[index]
			if att, ok := seenName[alert.Name()]; ok { // skip attachments for the same alert name
				if att.state != alert.Status() && att.state == model.AlertResolved { // change to firing if attachment state is firing
					att.state = alert.Status()
				}
				return nil
			}
			attachment, err := d.getAttachment(ctx, alert, image)
			if err != nil {
				level.Error(l).Log("msg", "failed to create an attachment for Discord", "alert", alert, "err", err)
				return nil
			}

			// We got an attachment, either using the image URL or bytes.
			attachments = append(attachments, attachment)
			seenName[alert.Name()] = attachment
			return nil
		}, alerts...)
	if err != nil {
		// We still return the attachments we managed to create before reaching the error.
		level.Warn(l).Log("msg", "failed to create all image attachments for Discord notification", "err", err)
	}

	return attachments
}

// getAttachment takes an alert and generates a Discord attachment containing an image for it.
// If the image has no public URL, it uses the raw bytes for uploading directly to Discord.
func (d Notifier) getAttachment(ctx context.Context, alert *types.Alert, image images.Image) (*discordAttachment, error) {
	if image.HasURL() {
		return &discordAttachment{
			url:       image.URL,
			state:     alert.Status(),
			alertName: alert.Name(),
		}, nil
	}

	// There's an image but it has no public URL, use the bytes for the attachment.
	r, err := image.RawData(ctx)
	if err != nil {
		return nil, err
	}
	return &discordAttachment{
		url:       "attachment://" + r.Name,
		name:      r.Name,
		content:   r.Content,
		state:     alert.Status(),
		alertName: alert.Name(),
	}, nil
}

func (d Notifier) buildRequest(url string, body []byte, attachments []*discordAttachment, l log.Logger) (*receivers.SendWebhookSettings, error) {
	cmd := &receivers.SendWebhookSettings{
		URL:        url,
		HTTPMethod: "POST",
	}
	if len(attachments) == 0 {
		cmd.ContentType = "application/json"
		cmd.Body = string(body)
		return cmd, nil
	}

	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	defer func() {
		if err := w.Close(); err != nil {
			// Shouldn't matter since we already close w explicitly on the non-error path
			level.Warn(l).Log("msg", "failed to close multipart writer", "err", err)
		}
	}()

	payload, err := w.CreateFormField("payload_json")
	if err != nil {
		return nil, err
	}

	if _, err := payload.Write(body); err != nil {
		return nil, err
	}

	for _, a := range attachments {
		if len(a.content) > 0 { // We have an image to upload.
			part, err := w.CreateFormFile("", a.name)
			if err != nil {
				return nil, err
			}
			_, err = part.Write(a.content)
			if err != nil {
				return nil, err
			}
		}
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	cmd.ContentType = w.FormDataContentType()
	cmd.Body = b.String()
	return cmd, nil
}
