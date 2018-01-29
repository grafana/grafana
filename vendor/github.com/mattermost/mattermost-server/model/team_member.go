// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type TeamMember struct {
	TeamId   string `json:"team_id"`
	UserId   string `json:"user_id"`
	Roles    string `json:"roles"`
	DeleteAt int64  `json:"delete_at"`
}

type TeamUnread struct {
	TeamId       string `json:"team_id"`
	MsgCount     int64  `json:"msg_count"`
	MentionCount int64  `json:"mention_count"`
}

func (o *TeamMember) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *TeamUnread) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamMemberFromJson(data io.Reader) *TeamMember {
	decoder := json.NewDecoder(data)
	var o TeamMember
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func TeamUnreadFromJson(data io.Reader) *TeamUnread {
	decoder := json.NewDecoder(data)
	var o TeamUnread
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func TeamMembersToJson(o []*TeamMember) string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func TeamMembersFromJson(data io.Reader) []*TeamMember {
	decoder := json.NewDecoder(data)
	var o []*TeamMember
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func TeamsUnreadToJson(o []*TeamUnread) string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func TeamsUnreadFromJson(data io.Reader) []*TeamUnread {
	decoder := json.NewDecoder(data)
	var o []*TeamUnread
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func (o *TeamMember) IsValid() *AppError {

	if len(o.TeamId) != 26 {
		return NewAppError("TeamMember.IsValid", "model.team_member.is_valid.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.UserId) != 26 {
		return NewAppError("TeamMember.IsValid", "model.team_member.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *TeamMember) PreUpdate() {
}

func (o *TeamMember) GetRoles() []string {
	return strings.Fields(o.Roles)
}
