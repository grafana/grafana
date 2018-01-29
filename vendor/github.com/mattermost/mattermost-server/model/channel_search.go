// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ChannelSearch struct {
	Term string `json:"term"`
}

// ToJson convert a Channel to a json string
func (c *ChannelSearch) ToJson() string {
	b, err := json.Marshal(c)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

// ChannelSearchFromJson will decode the input and return a Channel
func ChannelSearchFromJson(data io.Reader) *ChannelSearch {
	decoder := json.NewDecoder(data)
	var cs ChannelSearch
	err := decoder.Decode(&cs)
	if err == nil {
		return &cs
	} else {
		return nil
	}
}
