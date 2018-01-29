// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const (
	COMMAND_METHOD_POST = "P"
	COMMAND_METHOD_GET  = "G"
	MIN_TRIGGER_LENGTH  = 1
	MAX_TRIGGER_LENGTH  = 128
)

type Command struct {
	Id               string `json:"id"`
	Token            string `json:"token"`
	CreateAt         int64  `json:"create_at"`
	UpdateAt         int64  `json:"update_at"`
	DeleteAt         int64  `json:"delete_at"`
	CreatorId        string `json:"creator_id"`
	TeamId           string `json:"team_id"`
	Trigger          string `json:"trigger"`
	Method           string `json:"method"`
	Username         string `json:"username"`
	IconURL          string `json:"icon_url"`
	AutoComplete     bool   `json:"auto_complete"`
	AutoCompleteDesc string `json:"auto_complete_desc"`
	AutoCompleteHint string `json:"auto_complete_hint"`
	DisplayName      string `json:"display_name"`
	Description      string `json:"description"`
	URL              string `json:"url"`
}

func (o *Command) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandFromJson(data io.Reader) *Command {
	decoder := json.NewDecoder(data)
	var o Command
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func CommandListToJson(l []*Command) string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandListFromJson(data io.Reader) []*Command {
	decoder := json.NewDecoder(data)
	var o []*Command
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func (o *Command) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("Command.IsValid", "model.command.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Token) != 26 {
		return NewAppError("Command.IsValid", "model.command.is_valid.token.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Command.IsValid", "model.command.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Command.IsValid", "model.command.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.CreatorId) != 26 {
		return NewAppError("Command.IsValid", "model.command.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.TeamId) != 26 {
		return NewAppError("Command.IsValid", "model.command.is_valid.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Trigger) < MIN_TRIGGER_LENGTH || len(o.Trigger) > MAX_TRIGGER_LENGTH || strings.Index(o.Trigger, "/") == 0 || strings.Contains(o.Trigger, " ") {
		return NewAppError("Command.IsValid", "model.command.is_valid.trigger.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.URL) == 0 || len(o.URL) > 1024 {
		return NewAppError("Command.IsValid", "model.command.is_valid.url.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidHttpUrl(o.URL) {
		return NewAppError("Command.IsValid", "model.command.is_valid.url_http.app_error", nil, "", http.StatusBadRequest)
	}

	if !(o.Method == COMMAND_METHOD_GET || o.Method == COMMAND_METHOD_POST) {
		return NewAppError("Command.IsValid", "model.command.is_valid.method.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.DisplayName) > 64 {
		return NewAppError("Command.IsValid", "model.command.is_valid.display_name.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Description) > 128 {
		return NewAppError("Command.IsValid", "model.command.is_valid.description.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (o *Command) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.Token == "" {
		o.Token = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
}

func (o *Command) PreUpdate() {
	o.UpdateAt = GetMillis()
}

func (o *Command) Sanitize() {
	o.Token = ""
	o.CreatorId = ""
	o.Method = ""
	o.URL = ""
	o.Username = ""
	o.IconURL = ""
}
