// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"sort"
	"strings"
	"unicode/utf8"
)

const (
	CHANNEL_OPEN                   = "O"
	CHANNEL_PRIVATE                = "P"
	CHANNEL_DIRECT                 = "D"
	CHANNEL_GROUP                  = "G"
	CHANNEL_GROUP_MAX_USERS        = 8
	CHANNEL_GROUP_MIN_USERS        = 3
	DEFAULT_CHANNEL                = "town-square"
	CHANNEL_DISPLAY_NAME_MAX_RUNES = 64
	CHANNEL_NAME_MIN_LENGTH        = 2
	CHANNEL_NAME_MAX_LENGTH        = 64
	CHANNEL_NAME_UI_MAX_LENGTH     = 22
	CHANNEL_HEADER_MAX_RUNES       = 1024
	CHANNEL_PURPOSE_MAX_RUNES      = 250
	CHANNEL_CACHE_SIZE             = 25000
)

type Channel struct {
	Id            string `json:"id"`
	CreateAt      int64  `json:"create_at"`
	UpdateAt      int64  `json:"update_at"`
	DeleteAt      int64  `json:"delete_at"`
	TeamId        string `json:"team_id"`
	Type          string `json:"type"`
	DisplayName   string `json:"display_name"`
	Name          string `json:"name"`
	Header        string `json:"header"`
	Purpose       string `json:"purpose"`
	LastPostAt    int64  `json:"last_post_at"`
	TotalMsgCount int64  `json:"total_msg_count"`
	ExtraUpdateAt int64  `json:"extra_update_at"`
	CreatorId     string `json:"creator_id"`
}

type ChannelPatch struct {
	DisplayName *string `json:"display_name"`
	Name        *string `json:"name"`
	Header      *string `json:"header"`
	Purpose     *string `json:"purpose"`
}

func (o *Channel) DeepCopy() *Channel {
	copy := *o
	return &copy
}

func (o *Channel) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *ChannelPatch) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelFromJson(data io.Reader) *Channel {
	decoder := json.NewDecoder(data)
	var o Channel
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func ChannelPatchFromJson(data io.Reader) *ChannelPatch {
	decoder := json.NewDecoder(data)
	var o ChannelPatch
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Channel) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Channel) StatsEtag() string {
	return Etag(o.Id, o.ExtraUpdateAt)
}

func (o *Channel) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.DisplayName) > CHANNEL_DISPLAY_NAME_MAX_RUNES {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.display_name.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidChannelIdentifier(o.Name) {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.2_or_more.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !(o.Type == CHANNEL_OPEN || o.Type == CHANNEL_PRIVATE || o.Type == CHANNEL_DIRECT || o.Type == CHANNEL_GROUP) {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Header) > CHANNEL_HEADER_MAX_RUNES {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.header.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Purpose) > CHANNEL_PURPOSE_MAX_RUNES {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.purpose.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.CreatorId) > 26 {
		return NewAppError("Channel.IsValid", "model.channel.is_valid.creator_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *Channel) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
	o.ExtraUpdateAt = o.CreateAt
}

func (o *Channel) PreUpdate() {
	o.UpdateAt = GetMillis()
}

func (o *Channel) ExtraUpdated() {
	o.ExtraUpdateAt = GetMillis()
}

func (o *Channel) IsGroupOrDirect() bool {
	return o.Type == CHANNEL_DIRECT || o.Type == CHANNEL_GROUP
}

func (o *Channel) Patch(patch *ChannelPatch) {
	if patch.DisplayName != nil {
		o.DisplayName = *patch.DisplayName
	}

	if patch.Name != nil {
		o.Name = *patch.Name
	}

	if patch.Header != nil {
		o.Header = *patch.Header
	}

	if patch.Purpose != nil {
		o.Purpose = *patch.Purpose
	}
}

func GetDMNameFromIds(userId1, userId2 string) string {
	if userId1 > userId2 {
		return userId2 + "__" + userId1
	} else {
		return userId1 + "__" + userId2
	}
}

func GetGroupDisplayNameFromUsers(users []*User, truncate bool) string {
	usernames := make([]string, len(users))
	for index, user := range users {
		usernames[index] = user.Username
	}

	sort.Strings(usernames)

	name := strings.Join(usernames, ", ")

	if truncate && len(name) > CHANNEL_NAME_MAX_LENGTH {
		name = name[:CHANNEL_NAME_MAX_LENGTH]
	}

	return name
}

func GetGroupNameFromUserIds(userIds []string) string {
	sort.Strings(userIds)

	h := sha1.New()
	for _, id := range userIds {
		io.WriteString(h, id)
	}

	return hex.EncodeToString(h.Sum(nil))
}
