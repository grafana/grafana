// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type TeamSearch struct {
	Term string `json:"term"`
}

// ToJson convert a TeamSearch to json string
func (c *TeamSearch) ToJson() string {
	b, err := json.Marshal(c)
	if err != nil {
		return ""
	}

	return string(b)
}

// TeamSearchFromJson decodes the input and returns a TeamSearch
func TeamSearchFromJson(data io.Reader) *TeamSearch {
	decoder := json.NewDecoder(data)
	var cs TeamSearch
	err := decoder.Decode(&cs)
	if err == nil {
		return &cs
	}

	return nil
}
