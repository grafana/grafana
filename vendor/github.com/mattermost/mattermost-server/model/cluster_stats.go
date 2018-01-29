// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ClusterStats struct {
	Id                        string `json:"id"`
	TotalWebsocketConnections int    `json:"total_websocket_connections"`
	TotalReadDbConnections    int    `json:"total_read_db_connections"`
	TotalMasterDbConnections  int    `json:"total_master_db_connections"`
}

func (me *ClusterStats) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ClusterStatsFromJson(data io.Reader) *ClusterStats {
	decoder := json.NewDecoder(data)
	var me ClusterStats
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}
