// Copyright 2024 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package msteams

import "encoding/json"

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
