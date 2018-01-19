// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package logadmin

import (
	vkit "cloud.google.com/go/logging/apiv2"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	mrpb "google.golang.org/genproto/googleapis/api/monitoredres"
	logpb "google.golang.org/genproto/googleapis/logging/v2"
)

// ResourceDescriptors returns a ResourceDescriptorIterator
// for iterating over MonitoredResourceDescriptors. Requires ReadScope or AdminScope.
// See https://cloud.google.com/logging/docs/api/v2/#monitored-resources for an explanation of
// monitored resources.
// See https://cloud.google.com/logging/docs/api/v2/resource-list for a list of monitored resources.
func (c *Client) ResourceDescriptors(ctx context.Context) *ResourceDescriptorIterator {
	it := &ResourceDescriptorIterator{
		it: c.lClient.ListMonitoredResourceDescriptors(ctx,
			&logpb.ListMonitoredResourceDescriptorsRequest{}),
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.items) },
		func() interface{} { b := it.items; it.items = nil; return b })
	return it
}

// ResourceDescriptorIterator is an iterator over MonitoredResourceDescriptors.
type ResourceDescriptorIterator struct {
	it       *vkit.MonitoredResourceDescriptorIterator
	pageInfo *iterator.PageInfo
	nextFunc func() error
	items    []*mrpb.MonitoredResourceDescriptor
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *ResourceDescriptorIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

// Next returns the next result. Its second return value is Done if there are
// no more results. Once Next returns Done, all subsequent calls will return
// Done.
func (it *ResourceDescriptorIterator) Next() (*mrpb.MonitoredResourceDescriptor, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	item := it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *ResourceDescriptorIterator) fetch(pageSize int, pageToken string) (string, error) {
	return iterFetch(pageSize, pageToken, it.it.PageInfo(), func() error {
		item, err := it.it.Next()
		if err != nil {
			return err
		}
		it.items = append(it.items, item)
		return nil
	})
}
