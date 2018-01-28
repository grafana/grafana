// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
)

type SlackAttachment struct {
	Id         int64                   `json:"id"`
	Fallback   string                  `json:"fallback"`
	Color      string                  `json:"color"`
	Pretext    string                  `json:"pretext"`
	AuthorName string                  `json:"author_name"`
	AuthorLink string                  `json:"author_link"`
	AuthorIcon string                  `json:"author_icon"`
	Title      string                  `json:"title"`
	TitleLink  string                  `json:"title_link"`
	Text       string                  `json:"text"`
	Fields     []*SlackAttachmentField `json:"fields"`
	ImageURL   string                  `json:"image_url"`
	ThumbURL   string                  `json:"thumb_url"`
	Footer     string                  `json:"footer"`
	FooterIcon string                  `json:"footer_icon"`
	Timestamp  interface{}             `json:"ts"` // This is either a string or an int64
	Actions    []*PostAction           `json:"actions,omitempty"`
}

type SlackAttachmentField struct {
	Title string      `json:"title"`
	Value interface{} `json:"value"`
	Short bool        `json:"short"`
}

func StringifySlackFieldValue(a []*SlackAttachment) []*SlackAttachment {
	var nonNilAttachments []*SlackAttachment
	for _, attachment := range a {
		if attachment == nil {
			continue
		}
		nonNilAttachments = append(nonNilAttachments, attachment)

		var nonNilFields []*SlackAttachmentField
		for _, field := range attachment.Fields {
			if field == nil {
				continue
			}
			nonNilFields = append(nonNilFields, field)

			if field.Value != nil {
				// Ensure the value is set to a string if it is set
				field.Value = fmt.Sprintf("%v", field.Value)
			}
		}
		attachment.Fields = nonNilFields
	}
	return nonNilAttachments
}
