// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
)

type Reaction struct {
	UserId    string `json:"user_id"`
	PostId    string `json:"post_id"`
	EmojiName string `json:"emoji_name"`
	CreateAt  int64  `json:"create_at"`
}

func (o *Reaction) ToJson() string {
	if b, err := json.Marshal(o); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ReactionFromJson(data io.Reader) *Reaction {
	var o Reaction

	if err := json.NewDecoder(data).Decode(&o); err != nil {
		return nil
	} else {
		return &o
	}
}

func ReactionsToJson(o []*Reaction) string {
	if b, err := json.Marshal(o); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ReactionsFromJson(data io.Reader) []*Reaction {
	var o []*Reaction

	if err := json.NewDecoder(data).Decode(&o); err != nil {
		return nil
	} else {
		return o
	}
}

func (o *Reaction) IsValid() *AppError {
	if len(o.UserId) != 26 {
		return NewAppError("Reaction.IsValid", "model.reaction.is_valid.user_id.app_error", nil, "user_id="+o.UserId, http.StatusBadRequest)
	}

	if len(o.PostId) != 26 {
		return NewAppError("Reaction.IsValid", "model.reaction.is_valid.post_id.app_error", nil, "post_id="+o.PostId, http.StatusBadRequest)
	}

	validName := regexp.MustCompile(`^[a-zA-Z0-9\-\+_]+$`)

	if len(o.EmojiName) == 0 || len(o.EmojiName) > 64 || !validName.MatchString(o.EmojiName) {
		return NewAppError("Reaction.IsValid", "model.reaction.is_valid.emoji_name.app_error", nil, "emoji_name="+o.EmojiName, http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Reaction.IsValid", "model.reaction.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *Reaction) PreSave() {
	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}
}
