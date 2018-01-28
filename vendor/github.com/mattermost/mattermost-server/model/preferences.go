// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type Preferences []Preference

func (o *Preferences) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func PreferencesFromJson(data io.Reader) (Preferences, error) {
	decoder := json.NewDecoder(data)
	var o Preferences
	err := decoder.Decode(&o)
	if err == nil {
		return o, nil
	} else {
		return nil, err
	}
}
