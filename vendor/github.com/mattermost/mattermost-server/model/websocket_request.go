// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"

	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type WebSocketRequest struct {
	// Client-provided fields
	Seq    int64                  `json:"seq"`
	Action string                 `json:"action"`
	Data   map[string]interface{} `json:"data"`

	// Server-provided fields
	Session Session              `json:"-"`
	T       goi18n.TranslateFunc `json:"-"`
	Locale  string               `json:"-"`
}

func (o *WebSocketRequest) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func WebSocketRequestFromJson(data io.Reader) *WebSocketRequest {
	decoder := json.NewDecoder(data)
	var o WebSocketRequest
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
