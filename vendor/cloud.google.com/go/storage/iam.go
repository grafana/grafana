// Copyright 2017 Google LLC
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
	"context"

	"cloud.google.com/go/iam"
	"cloud.google.com/go/iam/apiv1/iampb"
	raw "google.golang.org/api/storage/v1"
	"google.golang.org/genproto/googleapis/type/expr"
)

// IAM provides access to IAM access control for the bucket.
func (b *BucketHandle) IAM() *iam.Handle {
	return iam.InternalNewHandleClient(&iamClient{
		userProject: b.userProject,
		retry:       b.retry,
		client:      b.c,
	}, b.name)
}

// iamClient implements the iam.client interface.
type iamClient struct {
	userProject string
	retry       *retryConfig
	client      *Client
}

func (c *iamClient) Get(ctx context.Context, resource string) (p *iampb.Policy, err error) {
	return c.GetWithVersion(ctx, resource, 1)
}

func (c *iamClient) GetWithVersion(ctx context.Context, resource string, requestedPolicyVersion int32) (p *iampb.Policy, err error) {
	ctx, _ = startSpan(ctx, "storage.IAM.Get")
	defer func() { endSpan(ctx, err) }()

	o := makeStorageOpts(true, c.retry, c.userProject)
	return c.client.tc.GetIamPolicy(ctx, resource, requestedPolicyVersion, o...)
}

func (c *iamClient) Set(ctx context.Context, resource string, p *iampb.Policy) (err error) {
	ctx, _ = startSpan(ctx, "storage.IAM.Set")
	defer func() { endSpan(ctx, err) }()

	isIdempotent := len(p.Etag) > 0
	o := makeStorageOpts(isIdempotent, c.retry, c.userProject)
	return c.client.tc.SetIamPolicy(ctx, resource, p, o...)
}

func (c *iamClient) Test(ctx context.Context, resource string, perms []string) (permissions []string, err error) {
	ctx, _ = startSpan(ctx, "storage.IAM.Test")
	defer func() { endSpan(ctx, err) }()

	o := makeStorageOpts(true, c.retry, c.userProject)
	return c.client.tc.TestIamPermissions(ctx, resource, perms, o...)
}

func iamToStoragePolicy(ip *iampb.Policy) *raw.Policy {
	return &raw.Policy{
		Bindings: iamToStorageBindings(ip.Bindings),
		Etag:     string(ip.Etag),
		Version:  int64(ip.Version),
	}
}

func iamToStorageBindings(ibs []*iampb.Binding) []*raw.PolicyBindings {
	var rbs []*raw.PolicyBindings
	for _, ib := range ibs {
		rbs = append(rbs, &raw.PolicyBindings{
			Role:      ib.Role,
			Members:   ib.Members,
			Condition: iamToStorageCondition(ib.Condition),
		})
	}
	return rbs
}

func iamToStorageCondition(exprpb *expr.Expr) *raw.Expr {
	if exprpb == nil {
		return nil
	}
	return &raw.Expr{
		Expression:  exprpb.Expression,
		Description: exprpb.Description,
		Location:    exprpb.Location,
		Title:       exprpb.Title,
	}
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
			Role:      rb.Role,
			Members:   rb.Members,
			Condition: iamFromStorageCondition(rb.Condition),
		})
	}
	return ibs
}

func iamFromStorageCondition(rawexpr *raw.Expr) *expr.Expr {
	if rawexpr == nil {
		return nil
	}
	return &expr.Expr{
		Expression:  rawexpr.Expression,
		Description: rawexpr.Description,
		Location:    rawexpr.Location,
		Title:       rawexpr.Title,
	}
}
