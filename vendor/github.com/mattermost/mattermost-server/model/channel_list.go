// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ChannelList []*Channel

func (o *ChannelList) ToJson() string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func (o *ChannelList) Etag() string {

	id := "0"
	var t int64 = 0
	var delta int64 = 0

	for _, v := range *o {
		if v.LastPostAt > t {
			t = v.LastPostAt
			id = v.Id
		}

		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		}

	}

	return Etag(id, t, delta, len(*o))
}

func ChannelListFromJson(data io.Reader) *ChannelList {
	decoder := json.NewDecoder(data)
	var o ChannelList
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func ChannelSliceFromJson(data io.Reader) []*Channel {
	decoder := json.NewDecoder(data)
	var o []*Channel
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}
