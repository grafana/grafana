// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type OutgoingWebhook struct {
	Id           string      `json:"id"`
	Token        string      `json:"token"`
	CreateAt     int64       `json:"create_at"`
	UpdateAt     int64       `json:"update_at"`
	DeleteAt     int64       `json:"delete_at"`
	CreatorId    string      `json:"creator_id"`
	ChannelId    string      `json:"channel_id"`
	TeamId       string      `json:"team_id"`
	TriggerWords StringArray `json:"trigger_words"`
	TriggerWhen  int         `json:"trigger_when"`
	CallbackURLs StringArray `json:"callback_urls"`
	DisplayName  string      `json:"display_name"`
	Description  string      `json:"description"`
	ContentType  string      `json:"content_type"`
}

type OutgoingWebhookPayload struct {
	Token       string `json:"token"`
	TeamId      string `json:"team_id"`
	TeamDomain  string `json:"team_domain"`
	ChannelId   string `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Timestamp   int64  `json:"timestamp"`
	UserId      string `json:"user_id"`
	UserName    string `json:"user_name"`
	PostId      string `json:"post_id"`
	Text        string `json:"text"`
	TriggerWord string `json:"trigger_word"`
	FileIds     string `json:"file_ids"`
}

type OutgoingWebhookResponse struct {
	Text         *string         `json:"text"`
	Username     string          `json:"username"`
	IconURL      string          `json:"icon_url"`
	Props        StringInterface `json:"props"`
	Type         string          `json:"type"`
	ResponseType string          `json:"response_type"`
}

const OUTGOING_HOOK_RESPONSE_TYPE_COMMENT = "comment"

func (o *OutgoingWebhookPayload) ToJSON() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *OutgoingWebhookPayload) ToFormValues() string {
	v := url.Values{}
	v.Set("token", o.Token)
	v.Set("team_id", o.TeamId)
	v.Set("team_domain", o.TeamDomain)
	v.Set("channel_id", o.ChannelId)
	v.Set("channel_name", o.ChannelName)
	v.Set("timestamp", strconv.FormatInt(o.Timestamp/1000, 10))
	v.Set("user_id", o.UserId)
	v.Set("user_name", o.UserName)
	v.Set("post_id", o.PostId)
	v.Set("text", o.Text)
	v.Set("trigger_word", o.TriggerWord)
	v.Set("file_ids", o.FileIds)

	return v.Encode()
}

func (o *OutgoingWebhook) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func OutgoingWebhookFromJson(data io.Reader) *OutgoingWebhook {
	decoder := json.NewDecoder(data)
	var o OutgoingWebhook
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func OutgoingWebhookListToJson(l []*OutgoingWebhook) string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func OutgoingWebhookListFromJson(data io.Reader) []*OutgoingWebhook {
	decoder := json.NewDecoder(data)
	var o []*OutgoingWebhook
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func (o *OutgoingWebhookResponse) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func OutgoingWebhookResponseFromJson(data io.Reader) *OutgoingWebhookResponse {
	decoder := json.NewDecoder(data)
	var o OutgoingWebhookResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *OutgoingWebhook) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Token) != 26 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.token.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.CreatorId) != 26 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.ChannelId) != 0 && len(o.ChannelId) != 26 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.TeamId) != 26 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(fmt.Sprintf("%s", o.TriggerWords)) > 1024 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.words.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.TriggerWords) != 0 {
		for _, triggerWord := range o.TriggerWords {
			if len(triggerWord) == 0 {
				return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.trigger_words.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	if len(o.CallbackURLs) == 0 || len(fmt.Sprintf("%s", o.CallbackURLs)) > 1024 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.callback.app_error", nil, "", http.StatusBadRequest)
	}

	for _, callback := range o.CallbackURLs {
		if !IsValidHttpUrl(callback) {
			return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if len(o.DisplayName) > 64 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.display_name.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Description) > 128 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.description.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.ContentType) > 128 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.content_type.app_error", nil, "", http.StatusBadRequest)
	}

	if o.TriggerWhen > 1 {
		return NewAppError("OutgoingWebhook.IsValid", "model.outgoing_hook.is_valid.content_type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *OutgoingWebhook) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.Token == "" {
		o.Token = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
}

func (o *OutgoingWebhook) PreUpdate() {
	o.UpdateAt = GetMillis()
}

func (o *OutgoingWebhook) TriggerWordExactMatch(word string) bool {
	if len(word) == 0 {
		return false
	}

	for _, trigger := range o.TriggerWords {
		if trigger == word {
			return true
		}
	}

	return false
}

func (o *OutgoingWebhook) TriggerWordStartsWith(word string) bool {
	if len(word) == 0 {
		return false
	}

	for _, trigger := range o.TriggerWords {
		if strings.HasPrefix(word, trigger) {
			return true
		}
	}

	return false
}

func (o *OutgoingWebhook) GetTriggerWord(word string, isExactMatch bool) (triggerWord string) {
	if len(word) == 0 {
		return
	}

	if isExactMatch {
		for _, trigger := range o.TriggerWords {
			if trigger == word {
				triggerWord = trigger
				break
			}
		}
	} else {
		for _, trigger := range o.TriggerWords {
			if strings.HasPrefix(word, trigger) {
				triggerWord = trigger
				break
			}
		}
	}

	return triggerWord
}
