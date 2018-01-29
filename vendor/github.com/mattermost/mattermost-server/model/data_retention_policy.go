// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type DataRetentionPolicy struct {
	MessageDeletionEnabled bool  `json:"message_deletion_enabled"`
	FileDeletionEnabled    bool  `json:"file_deletion_enabled"`
	MessageRetentionCutoff int64 `json:"message_retention_cutoff"`
	FileRetentionCutoff    int64 `json:"file_retention_cutoff"`
}

func (me *DataRetentionPolicy) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func DataRetentionPolicyFromJson(data io.Reader) *DataRetentionPolicy {
	decoder := json.NewDecoder(data)
	var me DataRetentionPolicy
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}
