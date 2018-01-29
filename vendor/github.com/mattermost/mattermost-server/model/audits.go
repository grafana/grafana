// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type Audits []Audit

func (o Audits) Etag() string {
	if len(o) > 0 {
		// the first in the list is always the most current
		return Etag(o[0].CreateAt)
	} else {
		return ""
	}
}

func (o Audits) ToJson() string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func AuditsFromJson(data io.Reader) Audits {
	decoder := json.NewDecoder(data)
	var o Audits
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}
