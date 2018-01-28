// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"sort"
)

type PostList struct {
	Order []string         `json:"order"`
	Posts map[string]*Post `json:"posts"`
}

func NewPostList() *PostList {
	return &PostList{
		Order: make([]string, 0),
		Posts: make(map[string]*Post),
	}
}

func (o *PostList) StripActionIntegrations() {
	posts := o.Posts
	o.Posts = make(map[string]*Post)
	for id, post := range posts {
		pcopy := *post
		pcopy.StripActionIntegrations()
		o.Posts[id] = &pcopy
	}
}

func (o *PostList) ToJson() string {
	copy := *o
	copy.StripActionIntegrations()
	b, err := json.Marshal(&copy)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *PostList) MakeNonNil() {
	if o.Order == nil {
		o.Order = make([]string, 0)
	}

	if o.Posts == nil {
		o.Posts = make(map[string]*Post)
	}

	for _, v := range o.Posts {
		v.MakeNonNil()
	}
}

func (o *PostList) AddOrder(id string) {

	if o.Order == nil {
		o.Order = make([]string, 0, 128)
	}

	o.Order = append(o.Order, id)
}

func (o *PostList) AddPost(post *Post) {

	if o.Posts == nil {
		o.Posts = make(map[string]*Post)
	}

	o.Posts[post.Id] = post
}

func (o *PostList) Extend(other *PostList) {
	for _, postId := range other.Order {
		if _, ok := o.Posts[postId]; !ok {
			o.AddPost(other.Posts[postId])
			o.AddOrder(postId)
		}
	}
}

func (o *PostList) SortByCreateAt() {
	sort.Slice(o.Order, func(i, j int) bool {
		return o.Posts[o.Order[i]].CreateAt > o.Posts[o.Order[j]].CreateAt
	})
}

func (o *PostList) Etag() string {

	id := "0"
	var t int64 = 0

	for _, v := range o.Posts {
		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		} else if v.UpdateAt == t && v.Id > id {
			t = v.UpdateAt
			id = v.Id
		}
	}

	orderId := ""
	if len(o.Order) > 0 {
		orderId = o.Order[0]
	}

	return Etag(orderId, id, t)
}

func (o *PostList) IsChannelId(channelId string) bool {
	for _, v := range o.Posts {
		if v.ChannelId != channelId {
			return false
		}
	}

	return true
}

func PostListFromJson(data io.Reader) *PostList {
	decoder := json.NewDecoder(data)
	var o PostList
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
