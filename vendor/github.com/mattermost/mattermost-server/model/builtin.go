// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

func NewBool(b bool) *bool       { return &b }
func NewInt(n int) *int          { return &n }
func NewInt64(n int64) *int64    { return &n }
func NewString(s string) *string { return &s }
