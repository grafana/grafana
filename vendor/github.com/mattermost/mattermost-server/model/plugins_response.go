// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type PluginInfo struct {
	Manifest
	Prepackaged bool `json:"prepackaged"`
}

type PluginsResponse struct {
	Active   []*PluginInfo `json:"active"`
	Inactive []*PluginInfo `json:"inactive"`
}

func (m *PluginsResponse) ToJson() string {
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func PluginsResponseFromJson(data io.Reader) *PluginsResponse {
	decoder := json.NewDecoder(data)
	var m PluginsResponse
	err := decoder.Decode(&m)
	if err == nil {
		return &m
	} else {
		return nil
	}
}
