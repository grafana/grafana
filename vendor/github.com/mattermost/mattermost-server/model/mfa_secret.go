// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type MfaSecret struct {
	Secret string `json:"secret"`
	QRCode string `json:"qr_code"`
}

func (me *MfaSecret) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func MfaSecretFromJson(data io.Reader) *MfaSecret {
	decoder := json.NewDecoder(data)
	var me MfaSecret
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}
