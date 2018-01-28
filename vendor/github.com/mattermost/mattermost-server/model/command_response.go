// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"strings"
)

const (
	COMMAND_RESPONSE_TYPE_IN_CHANNEL = "in_channel"
	COMMAND_RESPONSE_TYPE_EPHEMERAL  = "ephemeral"
)

type CommandResponse struct {
	ResponseType string             `json:"response_type"`
	Text         string             `json:"text"`
	Username     string             `json:"username"`
	IconURL      string             `json:"icon_url"`
	Type         string             `json:"type"`
	Props        StringInterface    `json:"props"`
	GotoLocation string             `json:"goto_location"`
	Attachments  []*SlackAttachment `json:"attachments"`
}

func (o *CommandResponse) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandResponseFromHTTPBody(contentType string, body io.Reader) *CommandResponse {
	if strings.TrimSpace(strings.Split(contentType, ";")[0]) == "application/json" {
		return CommandResponseFromJson(body)
	}
	if b, err := ioutil.ReadAll(body); err == nil {
		return CommandResponseFromPlainText(string(b))
	}
	return nil
}

func CommandResponseFromPlainText(text string) *CommandResponse {
	return &CommandResponse{
		Text: text,
	}
}

func CommandResponseFromJson(data io.Reader) *CommandResponse {
	decoder := json.NewDecoder(data)
	var o CommandResponse

	if err := decoder.Decode(&o); err != nil {
		return nil
	}

	o.Attachments = StringifySlackFieldValue(o.Attachments)

	return &o
}
