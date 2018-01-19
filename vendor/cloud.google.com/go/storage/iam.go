// Copyright 2017 Google Inc. All Rights Reserved.
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

package storage

import (
	"cloud.google.com/go/iam"
	"golang.org/x/net/context"
	raw "google.golang.org/api/storage/v1"
	iampb "google.golang.org/genproto/googleapis/iam/v1"
)

// IAM provides access to IAM access control for the bucket.
func (b *BucketHandle) IAM() *iam.Handle {
	return iam.InternalNewHandleClient(&iamClient{
		raw:         b.c.raw,
		userProject: b.userProject,
	}, b.name)
}

// iamClient implements the iam.client interface.
type iamClient struct {
	raw         *raw.Service
	userProject string
}

func (c *iamClient) Get(ctx context.Context, resource string) (*iampb.Policy, error) {
	call := c.raw.Buckets.GetIamPolicy(resource)
	setClientHeader(call.Header())
	if c.userProject != "" {
		call.UserProject(c.userProject)
	}
	var rp *raw.Policy
	var err error
	err = runWithRetry(ctx, func() error {
		rp, err = call.Context(ctx).Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return iamFromStoragePolicy(rp), nil
}

func (c *iamClient) Set(ctx context.Context, resource string, p *iampb.Policy) error {
	rp := iamToStoragePolicy(p)
	call := c.raw.Buckets.SetIamPolicy(resource, rp)
	setClientHeader(call.Header())
	if c.userProject != "" {
		call.UserProject(c.userProject)
	}
	return runWithRetry(ctx, func() error {
		_, err := call.Context(ctx).Do()
		return err
	})
}

func (c *iamClient) Test(ctx context.Context, resource string, perms []string) ([]string, error) {
	call := c.raw.Buckets.TestIamPermissions(resource, perms)
	setClientHeader(call.Header())
	if c.userProject != "" {
		call.UserProject(c.userProject)
	}
	var res *raw.TestIamPermissionsResponse
	var err error
	err = runWithRetry(ctx, func() error {
		res, err = call.Context(ctx).Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return res.Permissions, nil
}

func iamToStoragePolicy(ip *iampb.Policy) *raw.Policy {
	return &raw.Policy{
		Bindings: iamToStorageBindings(ip.Bindings),
		Etag:     string(ip.Etag),
	}
}

func iamToStorageBindings(ibs []*iampb.Binding) []*raw.PolicyBindings {
	var rbs []*raw.PolicyBindings
	for _, ib := range ibs {
		rbs = append(rbs, &raw.PolicyBindings{
			Role:    ib.Role,
			Members: ib.Members,
		})
	}
	return rbs
}

func iamFromStoragePolicy(rp *raw.Policy) *iampb.Policy {
	return &iampb.Policy{
		Bindings: iamFromStorageBindings(rp.Bindings),
		Etag:     []byte(rp.Etag),
	}
}

func iamFromStorageBindings(rbs []*raw.PolicyBindings) []*iampb.Binding {
	var ibs []*iampb.Binding
	for _, rb := range rbs {
		ibs = append(ibs, &iampb.Binding{
			Role:    rb.Role,
			Members: rb.Members,
		})
	}
	return ibs
}
