// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	PUSH_STATUS           = "status"
	PUSH_STATUS_OK        = "OK"
	PUSH_STATUS_FAIL      = "FAIL"
	PUSH_STATUS_REMOVE    = "REMOVE"
	PUSH_STATUS_ERROR_MSG = "error"
)

type PushResponse map[string]string

func NewOkPushResponse() PushResponse {
	m := make(map[string]string)
	m[PUSH_STATUS] = PUSH_STATUS_OK
	return m
}

func NewRemovePushResponse() PushResponse {
	m := make(map[string]string)
	m[PUSH_STATUS] = PUSH_STATUS_REMOVE
	return m
}

func NewErrorPushResponse(message string) PushResponse {
	m := make(map[string]string)
	m[PUSH_STATUS] = PUSH_STATUS_FAIL
	m[PUSH_STATUS_ERROR_MSG] = message
	return m
}

func (me *PushResponse) ToJson() string {
	if b, err := json.Marshal(me); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func PushResponseFromJson(data io.Reader) PushResponse {
	decoder := json.NewDecoder(data)

	var objmap PushResponse
	if err := decoder.Decode(&objmap); err != nil {
		return make(map[string]string)
	} else {
		return objmap
	}
}
