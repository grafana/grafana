// Copyright 2019 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package ast

// Comments returns all comments associated with a given node.
func Comments(n Node) []*CommentGroup {
	c := n.commentInfo()
	if c == nil {
		return nil
	}
	return c.Comments()
}

// AddComment adds the given comment to the node if it supports it.
// If a node does not support comments, such as for CommentGroup or Comment,
// this call has no effect.
func AddComment(n Node, cg *CommentGroup) {
	c := n.commentInfo()
	if c == nil {
		return
	}
	c.AddComment(cg)
}

// SetComments replaces all comments of n with the given set of comments.
// If a node does not support comments, such as for CommentGroup or Comment,
// this call has no effect.
func SetComments(n Node, cgs []*CommentGroup) {
	c := n.commentInfo()
	if c == nil {
		return
	}
	c.SetComments(cgs)
}
