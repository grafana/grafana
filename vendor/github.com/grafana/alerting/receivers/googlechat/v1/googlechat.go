package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// Notifier is responsible for sending
// alert notifications to Google chat.
type Notifier struct {
	*receivers.Base
	ns         receivers.WebhookSender
	images     images.Provider
	tmpl       *templates.Template
	settings   Config
	appVersion string
}

var (
	// Provides current time. Can be overwritten in tests.
	timeNow = time.Now
)

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

// Notify send an alert notification to Google Chat.
func (gcn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := gcn.GetLogger(ctx)
	level.Debug(l).Log("msg", "sending notification")

	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, gcn.tmpl, as, l, &tmplErr)

	var widgets []widget

	if msg := tmpl(gcn.settings.Message); msg != "" {
		// Add a text paragraph widget for the message if there is a message.
		// Google Chat API doesn't accept an empty text property.
		widgets = append(widgets, textParagraphWidget{Text: text{Text: msg}})
	}

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Google Chat message", "err", tmplErr.Error())
		tmplErr = nil
	}

	if !gcn.settings.HideOpenButton {
		ruleURL := receivers.JoinURLPath(gcn.tmpl.ExternalURL.String(), "/alerting/list", l)
		if gcn.isURLAbsolute(ruleURL, l) {
			// Add a button widget (link to Grafana).
			widgets = append(widgets, buttonWidget{
				Buttons: []button{
					{
						TextButton: textButton{
							Text: "OPEN IN GRAFANA",
							OnClick: onClick{
								OpenLink: openLink{
									URL: ruleURL,
								},
							},
						},
					},
				},
			})
		} else {
			level.Warn(l).Log("msg", "Grafana external URL setting is missing or invalid. Skipping 'open in grafana' button to prevent Google from displaying empty alerts.", "ruleURL", ruleURL)
		}
	}

	// Add text paragraph widget for the build version and timestamp.
	if !gcn.settings.HideVersionInfo {
		widgets = append(widgets, textParagraphWidget{
			Text: text{
				Text: "Grafana v" + gcn.appVersion + " | " + (timeNow()).Format(time.RFC822),
			},
		})
	}

	title := tmpl(gcn.settings.Title)
	// Nest the required structs.
	res := &outerStruct{
		PreviewText:  title,
		FallbackText: title,
		Cards: []card{
			{
				Header: header{Title: title},
				Sections: []section{
					{Widgets: widgets},
				},
			},
		},
	}
	if screenshots := gcn.buildScreenshotCard(ctx, as, l); screenshots != nil {
		res.Cards = append(res.Cards, *screenshots)
	}

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template GoogleChat message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(gcn.settings.URL)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template GoogleChat URL", "err", tmplErr.Error(), "fallback", gcn.settings.URL)
		u = gcn.settings.URL
	}

	body, err := json.Marshal(res)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	cmd := &receivers.SendWebhookSettings{
		URL:        u,
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Content-Type": "application/json; charset=UTF-8",
		},
		Body: string(body),
	}

	if err := gcn.ns.SendWebhook(ctx, l, cmd); err != nil {
		level.Error(l).Log("msg", "failed to send Google Hangouts Chat alert", "err", err)
		return false, err
	}

	return true, nil
}

func (gcn *Notifier) SendResolved() bool {
	return !gcn.GetDisableResolveMessage()
}

func (gcn *Notifier) isURLAbsolute(urlToCheck string, l log.Logger) bool {
	parsed, err := url.Parse(urlToCheck)
	if err != nil {
		level.Warn(l).Log("msg", "could not parse URL", "urlToCheck", urlToCheck)
		return false
	}

	return parsed.IsAbs()
}

func (gcn *Notifier) buildScreenshotCard(ctx context.Context, alerts []*types.Alert, l log.Logger) *card {
	card := card{
		Header:   header{Title: "Screenshots"},
		Sections: []section{},
	}

	_ = images.WithStoredImages(ctx, l, gcn.images,
		func(index int, image images.Image) error {
			if len(image.URL) == 0 {
				return nil
			}

			section := section{
				Widgets: []widget{
					textParagraphWidget{
						Text: text{
							Text: fmt.Sprintf("%s: %s", alerts[index].Status(), alerts[index].Name()),
						},
					},
					imageWidget{Image: imageData{ImageURL: image.URL}},
				},
			}
			card.Sections = append(card.Sections, section)

			return nil
		}, alerts...)

	if len(card.Sections) == 0 {
		return nil
	}
	return &card
}

// Structs used to build a custom Google Hangouts Chat message card.
// https://developers.google.com/chat/api/guides/message-formats/cards
type outerStruct struct {
	PreviewText  string `json:"previewText"`
	FallbackText string `json:"fallbackText"`
	Cards        []card `json:"cards"`
}

type card struct {
	Header   header    `json:"header"`
	Sections []section `json:"sections"`
}

type header struct {
	Title string `json:"title"`
}

type section struct {
	Widgets []widget `json:"widgets"`
}

// "generic" widget used to add different types of widgets (buttonWidget, textParagraphWidget, imageWidget)
type widget interface{}

type buttonWidget struct {
	Buttons []button `json:"buttons"`
}

type textParagraphWidget struct {
	Text text `json:"textParagraph"`
}

type imageWidget struct {
	Image imageData `json:"image"`
}

type imageData struct {
	ImageURL string `json:"imageUrl"`
}

type text struct {
	Text string `json:"text"`
}

type button struct {
	TextButton textButton `json:"textButton"`
}

type textButton struct {
	Text    string  `json:"text"`
	OnClick onClick `json:"onClick"`
}

type onClick struct {
	OpenLink openLink `json:"openLink"`
}

type openLink struct {
	URL string `json:"url"`
}
