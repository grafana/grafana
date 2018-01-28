// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"

	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type CommandArgs struct {
	UserId    string               `json:"user_id"`
	ChannelId string               `json:"channel_id"`
	TeamId    string               `json:"team_id"`
	RootId    string               `json:"root_id"`
	ParentId  string               `json:"parent_id"`
	Command   string               `json:"command"`
	SiteURL   string               `json:"-"`
	T         goi18n.TranslateFunc `json:"-"`
	Session   Session              `json:"-"`
}

func (o *CommandArgs) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandArgsFromJson(data io.Reader) *CommandArgs {
	decoder := json.NewDecoder(data)
	var o CommandArgs
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
