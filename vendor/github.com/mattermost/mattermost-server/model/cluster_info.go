// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
)

type ClusterInfo struct {
	Id         string `json:"id"`
	Version    string `json:"version"`
	ConfigHash string `json:"config_hash"`
	IpAddress  string `json:"ipaddress"`
	Hostname   string `json:"hostname"`
}

func (me *ClusterInfo) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (me *ClusterInfo) Copy() *ClusterInfo {
	json := me.ToJson()
	return ClusterInfoFromJson(strings.NewReader(json))
}

func ClusterInfoFromJson(data io.Reader) *ClusterInfo {
	decoder := json.NewDecoder(data)
	var me ClusterInfo
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}

func ClusterInfosToJson(objmap []*ClusterInfo) string {
	if b, err := json.Marshal(objmap); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ClusterInfosFromJson(data io.Reader) []*ClusterInfo {
	decoder := json.NewDecoder(data)

	var objmap []*ClusterInfo
	if err := decoder.Decode(&objmap); err != nil {
		return make([]*ClusterInfo, 0)
	} else {
		return objmap
	}
}
