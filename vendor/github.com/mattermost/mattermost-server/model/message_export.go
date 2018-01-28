// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type MessageExport struct {
	ChannelId          *string
	ChannelDisplayName *string

	UserId    *string
	UserEmail *string

	PostId       *string
	PostCreateAt *int64
	PostMessage  *string
	PostType     *string
	PostFileIds  StringArray
}
