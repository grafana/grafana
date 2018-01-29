// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type AnalyticsRow struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
}

type AnalyticsRows []*AnalyticsRow

func (me *AnalyticsRow) ToJson() string {
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AnalyticsRowFromJson(data io.Reader) *AnalyticsRow {
	decoder := json.NewDecoder(data)
	var me AnalyticsRow
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}

func (me AnalyticsRows) ToJson() string {
	if b, err := json.Marshal(me); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func AnalyticsRowsFromJson(data io.Reader) AnalyticsRows {
	decoder := json.NewDecoder(data)
	var me AnalyticsRows
	err := decoder.Decode(&me)
	if err == nil {
		return me
	} else {
		return nil
	}
}
