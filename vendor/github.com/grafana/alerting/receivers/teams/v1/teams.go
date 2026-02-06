package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/go-kit/log/level"
	"github.com/pkg/errors"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

const (
	ImageSizeSmall  = "small"
	ImageSizeMedium = "medium"
	ImageSizeLarge  = "large"

	TextColorDark      = "dark"
	TextColorLight     = "light"
	TextColorAccent    = "accent"
	TextColorGood      = "good"
	TextColorWarning   = "warning"
	TextColorAttention = "attention"

	TextSizeSmall      = "small"
	TextSizeMedium     = "medium"
	TextSizeLarge      = "large"
	TextSizeExtraLarge = "extraLarge"
	TextSizeDefault    = "default"

	TextWeightLighter = "lighter"
	TextWeightBolder  = "bolder"
	TextWeightDefault = "default"
)

// AdaptiveCardsMessage represents a message for adaptive cards.
type AdaptiveCardsMessage struct {
	Attachments []AdaptiveCardsAttachment `json:"attachments"`
	Summary     string                    `json:"summary,omitempty"` // Summary is the text shown in notifications
	Type        string                    `json:"type"`
}

// NewAdaptiveCardsMessage returns a message prepared for adaptive cards.
// https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using#send-adaptive-cards-using-an-incoming-webhook
// more info https://learn.microsoft.com/en-us/connectors/teams/?tabs=text1#microsoft-teams-webhook
func NewAdaptiveCardsMessage(card AdaptiveCard) AdaptiveCardsMessage {
	return AdaptiveCardsMessage{
		Attachments: []AdaptiveCardsAttachment{{
			ContentType: "application/vnd.microsoft.card.adaptive",
			Content:     card,
		}},
		Type: "message",
	}
}

// AdaptiveCardsAttachment contains an adaptive card.
type AdaptiveCardsAttachment struct {
	Content     AdaptiveCard `json:"content"`
	ContentType string       `json:"contentType"`
	ContentURL  string       `json:"contentUrl,omitempty"`
}

// AdaptiveCard repesents an Adaptive Card.
// https://adaptivecards.io/explorer/AdaptiveCard.html
type AdaptiveCard struct {
	Body    []AdaptiveCardItem
	Schema  string
	Type    string
	Version string
}

// NewAdaptiveCard returns a prepared Adaptive Card.
func NewAdaptiveCard() AdaptiveCard {
	return AdaptiveCard{
		Body:    make([]AdaptiveCardItem, 0),
		Schema:  "http://adaptivecards.io/schemas/adaptive-card.json",
		Type:    "AdaptiveCard",
		Version: "1.4",
	}
}

func (c *AdaptiveCard) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Body    []AdaptiveCardItem     `json:"body"`
		Schema  string                 `json:"$schema"`
		Type    string                 `json:"type"`
		Version string                 `json:"version"`
		MsTeams map[string]interface{} `json:"msTeams,omitempty"`
	}{
		Body:    c.Body,
		Schema:  c.Schema,
		Type:    c.Type,
		Version: c.Version,
		MsTeams: map[string]interface{}{"width": "Full"},
	})
}

// AppendItem appends an item, such as text or an image, to the Adaptive Card.
func (c *AdaptiveCard) AppendItem(i AdaptiveCardItem) {
	c.Body = append(c.Body, i)
}

// AdaptiveCardItem is an interface for adaptive card items such as containers, elements and inputs.
type AdaptiveCardItem interface {
	MarshalJSON() ([]byte, error)
}

// AdaptiveCardTextBlockItem is a TextBlock.
type AdaptiveCardTextBlockItem struct {
	Color  string
	Size   string
	Text   string
	Weight string
	Wrap   bool
}

func (i AdaptiveCardTextBlockItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type   string `json:"type"`
		Text   string `json:"text"`
		Color  string `json:"color,omitempty"`
		Size   string `json:"size,omitempty"`
		Weight string `json:"weight,omitempty"`
		Wrap   bool   `json:"wrap,omitempty"`
	}{
		Type:   "TextBlock",
		Text:   i.Text,
		Color:  i.Color,
		Size:   i.Size,
		Weight: i.Weight,
		Wrap:   i.Wrap,
	})
}

// AdaptiveCardImageSetItem is an ImageSet.
type AdaptiveCardImageSetItem struct {
	Images []AdaptiveCardImageItem
	Size   string
}

// AppendImage appends an image to image set.
func (i *AdaptiveCardImageSetItem) AppendImage(image AdaptiveCardImageItem) {
	i.Images = append(i.Images, image)
}

func (i AdaptiveCardImageSetItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type   string                  `json:"type"`
		Images []AdaptiveCardImageItem `json:"images"`
		Size   string                  `json:"imageSize"`
	}{
		Type:   "ImageSet",
		Images: i.Images,
		Size:   i.Size,
	})
}

// AdaptiveCardImageItem is an Image.
type AdaptiveCardImageItem struct {
	AltText string
	Size    string
	URL     string
}

func (i AdaptiveCardImageItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string                 `json:"type"`
		URL     string                 `json:"url"`
		AltText string                 `json:"altText,omitempty"`
		Size    string                 `json:"size,omitempty"`
		MsTeams map[string]interface{} `json:"msTeams,omitempty"`
	}{
		Type:    "Image",
		URL:     i.URL,
		AltText: i.AltText,
		Size:    i.Size,
		MsTeams: map[string]interface{}{"allowExpand": true},
	})
}

// AdaptiveCardActionSetItem is an ActionSet.
type AdaptiveCardActionSetItem struct {
	Actions []AdaptiveCardActionItem
}

func (i AdaptiveCardActionSetItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string                   `json:"type"`
		Actions []AdaptiveCardActionItem `json:"actions"`
	}{
		Type:    "ActionSet",
		Actions: i.Actions,
	})
}

type AdaptiveCardActionItem interface {
	MarshalJSON() ([]byte, error)
}

// AdaptiveCardOpenURLActionItem is an Action.OpenUrl action.
type AdaptiveCardOpenURLActionItem struct {
	IconURL string
	Title   string
	URL     string
}

func (i AdaptiveCardOpenURLActionItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string `json:"type"`
		Title   string `json:"title"`
		URL     string `json:"url"`
		IconURL string `json:"iconUrl,omitempty"`
	}{
		Type:    "Action.OpenUrl",
		Title:   i.Title,
		URL:     i.URL,
		IconURL: i.IconURL,
	})
}

type Notifier struct {
	*receivers.Base
	tmpl     *templates.Template
	ns       receivers.WebhookSender
	images   images.Provider
	settings Config
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		ns:       sender,
		images:   images,
		tmpl:     template,
		settings: cfg,
	}
}

func (tn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := tn.GetLogger(ctx)
	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, tn.tmpl, as, l, &tmplErr)

	card := NewAdaptiveCard()
	card.AppendItem(AdaptiveCardTextBlockItem{
		Color:  getTeamsTextColor(types.Alerts(as...)),
		Text:   tmpl(tn.settings.Title),
		Size:   TextSizeLarge,
		Weight: TextWeightBolder,
		Wrap:   true,
	})
	card.AppendItem(AdaptiveCardTextBlockItem{
		Text: tmpl(tn.settings.Message),
		Wrap: true,
	})

	var s AdaptiveCardImageSetItem
	_ = images.WithStoredImages(ctx, l, tn.images,
		func(_ int, image images.Image) error {
			if image.URL != "" {
				s.AppendImage(AdaptiveCardImageItem{URL: image.URL})
			}
			return nil
		},
		as...)

	if len(s.Images) > 2 {
		s.Size = ImageSizeMedium
		card.AppendItem(s)
	} else if len(s.Images) > 0 {
		s.Size = ImageSizeLarge
		card.AppendItem(s)
	}

	card.AppendItem(AdaptiveCardActionSetItem{
		Actions: []AdaptiveCardActionItem{
			AdaptiveCardOpenURLActionItem{
				Title: "View URL",
				URL:   receivers.JoinURLPath(tn.tmpl.ExternalURL.String(), "/alerting/list", l),
			},
		},
	})

	msg := NewAdaptiveCardsMessage(card)
	msg.Summary = tmpl(tn.settings.Title)

	// This check for tmplErr must happen before templating the URL
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Teams message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(tn.settings.URL)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Teams URL", "err", tmplErr.Error(), "fallback", tn.settings.URL)
		u = tn.settings.URL
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return false, fmt.Errorf("failed to marshal JSON: %w", err)
	}

	cmd := &receivers.SendWebhookSettings{URL: u, Body: string(b)}
	parsed, err := url.Parse(u)
	if err != nil {
		return false, fmt.Errorf("failed to parse URL: %w", err)
	}
	// TODO: remove it after August 15. Office webhooks are deprecated and are removed on August 15, https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/
	if strings.HasSuffix(parsed.Host, "webhook.office.com") {
		// Teams sometimes does not use status codes to show when a request has failed. Instead, the
		// response can contain an error message, irrespective of status code (i.e. https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using?tabs=cURL#rate-limiting-for-connectors)
		cmd.Validation = validateOfficeWebhookResponse
	} else {
		cmd.Validation = validateResponse(l)
	}

	if err := tn.ns.SendWebhook(ctx, l, cmd); err != nil {
		return false, errors.Wrap(err, "send notification to Teams")
	}

	return true, nil
}

//nolint:revive
func validateOfficeWebhookResponse(b []byte, statusCode int) error {
	// The request succeeded if the response is "1"
	// https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using?tabs=cURL#send-messages-using-curl-and-powershell
	if !bytes.Equal(b, []byte("1")) {
		return errors.New(string(b))
	}
	return nil
}

func validateResponse(l log.Logger) func(b []byte, statusCode int) error {
	return func(b []byte, statusCode int) error {
		if statusCode/100 == 2 {
			return nil
		}
		level.Error(l).Log("msg", "failed to send notification and parse response", "statusCode", statusCode, "body", string(b))
		errResponse := errorResponse{}
		err := json.Unmarshal(b, &errResponse)
		if err != nil {
			return fmt.Errorf("failed to send notification, got status code %d, check logs for more details", statusCode)
		}
		return fmt.Errorf("failed to send notification, got status code %d: (%s) %s", statusCode, errResponse.Error.Code, errResponse.Error.Message)
	}
}

func (tn *Notifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}

// getTeamsTextColor returns the text color for the message title.
func getTeamsTextColor(alerts model.Alerts) string {
	if receivers.GetAlertStatusColor(alerts.Status()) == receivers.ColorAlertFiring {
		return TextColorAttention
	}
	return TextColorGood
}
