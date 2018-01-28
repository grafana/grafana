// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
)

type ChannelCounts struct {
	Counts      map[string]int64 `json:"counts"`
	UpdateTimes map[string]int64 `json:"update_times"`
}

func (o *ChannelCounts) Etag() string {

	ids := []string{}
	for id := range o.Counts {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	str := ""
	for _, id := range ids {
		str += id + strconv.FormatInt(o.Counts[id], 10)
	}

	md5Counts := fmt.Sprintf("%x", md5.Sum([]byte(str)))

	var update int64 = 0
	for _, u := range o.UpdateTimes {
		if u > update {
			update = u
		}
	}

	return Etag(md5Counts, update)
}

func (o *ChannelCounts) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelCountsFromJson(data io.Reader) *ChannelCounts {
	decoder := json.NewDecoder(data)
	var o ChannelCounts
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
