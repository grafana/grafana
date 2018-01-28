// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

type Emoji struct {
	Id        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	DeleteAt  int64  `json:"delete_at"`
	CreatorId string `json:"creator_id"`
	Name      string `json:"name"`
}

func (emoji *Emoji) IsValid() *AppError {
	if len(emoji.Id) != 26 {
		return NewAppError("Emoji.IsValid", "model.emoji.id.app_error", nil, "", http.StatusBadRequest)
	}

	if emoji.CreateAt == 0 {
		return NewAppError("Emoji.IsValid", "model.emoji.create_at.app_error", nil, "id="+emoji.Id, http.StatusBadRequest)
	}

	if emoji.UpdateAt == 0 {
		return NewAppError("Emoji.IsValid", "model.emoji.update_at.app_error", nil, "id="+emoji.Id, http.StatusBadRequest)
	}

	if len(emoji.CreatorId) != 26 {
		return NewAppError("Emoji.IsValid", "model.emoji.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(emoji.Name) == 0 || len(emoji.Name) > 64 || !IsValidAlphaNumHyphenUnderscore(emoji.Name, false) {
		return NewAppError("Emoji.IsValid", "model.emoji.name.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (emoji *Emoji) PreSave() {
	if emoji.Id == "" {
		emoji.Id = NewId()
	}

	emoji.CreateAt = GetMillis()
	emoji.UpdateAt = emoji.CreateAt
}

func (emoji *Emoji) PreUpdate() {
	emoji.UpdateAt = GetMillis()
}

func (emoji *Emoji) ToJson() string {
	b, err := json.Marshal(emoji)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func EmojiFromJson(data io.Reader) *Emoji {
	decoder := json.NewDecoder(data)
	var emoji Emoji
	err := decoder.Decode(&emoji)
	if err == nil {
		return &emoji
	} else {
		return nil
	}
}

func EmojiListToJson(emojiList []*Emoji) string {
	b, err := json.Marshal(emojiList)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func EmojiListFromJson(data io.Reader) []*Emoji {
	decoder := json.NewDecoder(data)
	var emojiList []*Emoji
	err := decoder.Decode(&emojiList)
	if err == nil {
		return emojiList
	} else {
		return nil
	}
}
