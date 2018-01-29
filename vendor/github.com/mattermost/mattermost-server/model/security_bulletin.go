// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type SecurityBulletin struct {
	Id               string `json:"id"`
	AppliesToVersion string `json:"applies_to_version"`
}

type SecurityBulletins []SecurityBulletin

func (me *SecurityBulletin) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func SecurityBulletinFromJson(data io.Reader) *SecurityBulletin {
	decoder := json.NewDecoder(data)
	var o SecurityBulletin
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (me SecurityBulletins) ToJson() string {
	if b, err := json.Marshal(me); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func SecurityBulletinsFromJson(data io.Reader) SecurityBulletins {
	decoder := json.NewDecoder(data)
	var o SecurityBulletins
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}
