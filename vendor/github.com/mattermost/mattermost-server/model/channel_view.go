// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ChannelView struct {
	ChannelId     string `json:"channel_id"`
	PrevChannelId string `json:"prev_channel_id"`
}

func (o *ChannelView) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelViewFromJson(data io.Reader) *ChannelView {
	decoder := json.NewDecoder(data)
	var o ChannelView
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

type ChannelViewResponse struct {
	Status            string           `json:"status"`
	LastViewedAtTimes map[string]int64 `json:"last_viewed_at_times"`
}

func (o *ChannelViewResponse) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelViewResponseFromJson(data io.Reader) *ChannelViewResponse {
	decoder := json.NewDecoder(data)
	var o ChannelViewResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
