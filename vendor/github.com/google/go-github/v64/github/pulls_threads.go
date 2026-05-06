// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

// PullRequestThread represents a thread of comments on a pull request.
type PullRequestThread struct {
	ID       *int64                `json:"id,omitempty"`
	NodeID   *string               `json:"node_id,omitempty"`
	Comments []*PullRequestComment `json:"comments,omitempty"`
}

func (p PullRequestThread) String() string {
	return Stringify(p)
}
