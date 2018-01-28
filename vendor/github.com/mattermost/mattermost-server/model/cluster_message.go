// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	CLUSTER_EVENT_PUBLISH                                           = "publish"
	CLUSTER_EVENT_UPDATE_STATUS                                     = "update_status"
	CLUSTER_EVENT_INVALIDATE_ALL_CACHES                             = "inv_all_caches"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS                    = "inv_reactions"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOK                      = "inv_webhook"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_POSTS                = "inv_channel_posts"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS = "inv_channel_members_notify_props"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS              = "inv_channel_members"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME              = "inv_channel_name"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL                      = "inv_channel"
	CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER                         = "inv_user"
	CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER                      = "clear_session_user"

	CLUSTER_SEND_BEST_EFFORT = "best_effort"
	CLUSTER_SEND_RELIABLE    = "reliable"
)

type ClusterMessage struct {
	Event            string            `json:"event"`
	SendType         string            `json:"-"`
	WaitForAllToSend bool              `json:"-"`
	Data             string            `json:"data,omitempty"`
	Props            map[string]string `json:"props,omitempty"`
}

func (o *ClusterMessage) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ClusterMessageFromJson(data io.Reader) *ClusterMessage {
	decoder := json.NewDecoder(data)
	var o ClusterMessage
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
