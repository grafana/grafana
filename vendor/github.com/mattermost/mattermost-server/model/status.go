// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	STATUS_OFFLINE         = "offline"
	STATUS_AWAY            = "away"
	STATUS_DND             = "dnd"
	STATUS_ONLINE          = "online"
	STATUS_CACHE_SIZE      = SESSION_CACHE_SIZE
	STATUS_CHANNEL_TIMEOUT = 20000  // 20 seconds
	STATUS_MIN_UPDATE_TIME = 120000 // 2 minutes
)

type Status struct {
	UserId         string `json:"user_id"`
	Status         string `json:"status"`
	Manual         bool   `json:"manual"`
	LastActivityAt int64  `json:"last_activity_at"`
	ActiveChannel  string `json:"-" db:"-"`
}

func (o *Status) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func StatusFromJson(data io.Reader) *Status {
	decoder := json.NewDecoder(data)
	var o Status
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func StatusListToJson(u []*Status) string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func StatusListFromJson(data io.Reader) []*Status {
	decoder := json.NewDecoder(data)
	var statuses []*Status
	err := decoder.Decode(&statuses)
	if err == nil {
		return statuses
	} else {
		return nil
	}
}

func StatusMapToInterfaceMap(statusMap map[string]*Status) map[string]interface{} {
	interfaceMap := map[string]interface{}{}
	for _, s := range statusMap {
		// Omitted statues mean offline
		if s.Status != STATUS_OFFLINE {
			interfaceMap[s.UserId] = s.Status
		}
	}
	return interfaceMap
}
