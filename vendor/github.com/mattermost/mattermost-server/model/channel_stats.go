// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ChannelStats struct {
	ChannelId   string `json:"channel_id"`
	MemberCount int64  `json:"member_count"`
}

func (o *ChannelStats) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelStatsFromJson(data io.Reader) *ChannelStats {
	decoder := json.NewDecoder(data)
	var o ChannelStats
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
