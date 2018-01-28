// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type SuggestCommand struct {
	Suggestion  string `json:"suggestion"`
	Description string `json:"description"`
}

func (o *SuggestCommand) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func SuggestCommandFromJson(data io.Reader) *SuggestCommand {
	decoder := json.NewDecoder(data)
	var o SuggestCommand
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
