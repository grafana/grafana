// Copyright 2014 Google Inc. All Rights Reserved.
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
	"fmt"
	"net/http"
	"reflect"
	"time"

	"cloud.google.com/go/internal/optional"
	"golang.org/x/net/context"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/iterator"
	raw "google.golang.org/api/storage/v1"
)

// BucketHandle provides operations on a Google Cloud Storage bucket.
// Use Client.Bucket to get a handle.
type BucketHandle struct {
	c                *Client
	name             string
	acl              ACLHandle
	defaultObjectACL ACLHandle
	conds            *BucketConditions
	userProject      string // project for requester-pays buckets
}

// Bucket returns a BucketHandle, which provides operations on the named bucket.
// This call does not perform any network operations.
//
// The supplied name must contain only lowercase letters, numbers, dashes,
// underscores, and dots. The full specification for valid bucket names can be
// found at:
//   https://cloud.google.com/storage/docs/bucket-naming
func (c *Client) Bucket(name string) *BucketHandle {
	return &BucketHandle{
		c:    c,
		name: name,
		acl: ACLHandle{
			c:      c,
			bucket: name,
		},
		defaultObjectACL: ACLHandle{
			c:         c,
			bucket:    name,
			isDefault: true,
		},
	}
}

// Create creates the Bucket in the project.
// If attrs is nil the API defaults will be used.
func (b *BucketHandle) Create(ctx context.Context, projectID string, attrs *BucketAttrs) error {
	var bkt *raw.Bucket
	if attrs != nil {
		bkt = attrs.toRawBucket()
	} else {
		bkt = &raw.Bucket{}
	}
	bkt.Name = b.name
	req := b.c.raw.Buckets.Insert(projectID, bkt)
	setClientHeader(req.Header())
	return runWithRetry(ctx, func() error { _, err := req.Context(ctx).Do(); return err })
}

// Delete deletes the Bucket.
func (b *BucketHandle) Delete(ctx context.Context) error {
	req, err := b.newDeleteCall()
	if err != nil {
		return err
	}
	return runWithRetry(ctx, func() error { return req.Context(ctx).Do() })
}

func (b *BucketHandle) newDeleteCall() (*raw.BucketsDeleteCall, error) {
	req := b.c.raw.Buckets.Delete(b.name)
	setClientHeader(req.Header())
	if err := applyBucketConds("BucketHandle.Delete", b.conds, req); err != nil {
		return nil, err
	}
	if b.userProject != "" {
		req.UserProject(b.userProject)
	}
	return req, nil
}

// ACL returns an ACLHandle, which provides access to the bucket's access control list.
// This controls who can list, create or overwrite the objects in a bucket.
// This call does not perform any network operations.
func (b *BucketHandle) ACL() *ACLHandle {
	return &b.acl
}

// DefaultObjectACL returns an ACLHandle, which provides access to the bucket's default object ACLs.
// These ACLs are applied to newly created objects in this bucket that do not have a defined ACL.
// This call does not perform any network operations.
func (b *BucketHandle) DefaultObjectACL() *ACLHandle {
	return &b.defaultObjectACL
}

// Object returns an ObjectHandle, which provides operations on the named object.
// This call does not perform any network operations.
//
// name must consist entirely of valid UTF-8-encoded runes. The full specification
// for valid object names can be found at:
//   https://cloud.google.com/storage/docs/bucket-naming
func (b *BucketHandle) Object(name string) *ObjectHandle {
	return &ObjectHandle{
		c:      b.c,
		bucket: b.name,
		object: name,
		acl: ACLHandle{
			c:           b.c,
			bucket:      b.name,
			object:      name,
			userProject: b.userProject,
		},
		gen:         -1,
		userProject: b.userProject,
	}
}

// Attrs returns the metadata for the bucket.
func (b *BucketHandle) Attrs(ctx context.Context) (*BucketAttrs, error) {
	req, err := b.newGetCall()
	if err != nil {
		return nil, err
	}
	var resp *raw.Bucket
	err = runWithRetry(ctx, func() error {
		resp, err = req.Context(ctx).Do()
		return err
	})
	if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusNotFound {
		return nil, ErrBucketNotExist
	}
	if err != nil {
		return nil, err
	}
	return newBucket(resp), nil
}

func (b *BucketHandle) newGetCall() (*raw.BucketsGetCall, error) {
	req := b.c.raw.Buckets.Get(b.name).Projection("full")
	setClientHeader(req.Header())
	if err := applyBucketConds("BucketHandle.Attrs", b.conds, req); err != nil {
		return nil, err
	}
	if b.userProject != "" {
		req.UserProject(b.userProject)
	}
	return req, nil
}

func (b *BucketHandle) Update(ctx context.Context, uattrs BucketAttrsToUpdate) (*BucketAttrs, error) {
	req, err := b.newPatchCall(&uattrs)
	if err != nil {
		return nil, err
	}
	// TODO(jba): retry iff metagen is set?
	rb, err := req.Context(ctx).Do()
	if err != nil {
		return nil, err
	}
	return newBucket(rb), nil
}

func (b *BucketHandle) newPatchCall(uattrs *BucketAttrsToUpdate) (*raw.BucketsPatchCall, error) {
	rb := uattrs.toRawBucket()
	req := b.c.raw.Buckets.Patch(b.name, rb).Projection("full")
	setClientHeader(req.Header())
	if err := applyBucketConds("BucketHandle.Update", b.conds, req); err != nil {
		return nil, err
	}
	if b.userProject != "" {
		req.UserProject(b.userProject)
	}
	return req, nil
}

// BucketAttrs represents the metadata for a Google Cloud Storage bucket.
type BucketAttrs struct {
	// Name is the name of the bucket.
	Name string

	// ACL is the list of access control rules on the bucket.
	ACL []ACLRule

	// DefaultObjectACL is the list of access controls to
	// apply to new objects when no object ACL is provided.
	DefaultObjectACL []ACLRule

	// Location is the location of the bucket. It defaults to "US".
	Location string

	// MetaGeneration is the metadata generation of the bucket.
	MetaGeneration int64

	// StorageClass is the default storage class of the bucket. This defines
	// how objects in the bucket are stored and determines the SLA
	// and the cost of storage. Typical values are "MULTI_REGIONAL",
	// "REGIONAL", "NEARLINE", "COLDLINE", "STANDARD" and
	// "DURABLE_REDUCED_AVAILABILITY". Defaults to "STANDARD", which
	// is equivalent to "MULTI_REGIONAL" or "REGIONAL" depending on
	// the bucket's location settings.
	StorageClass string

	// Created is the creation time of the bucket.
	Created time.Time

	// VersioningEnabled reports whether this bucket has versioning enabled.
	// This field is read-only.
	VersioningEnabled bool

	// Labels are the bucket's labels.
	Labels map[string]string

	// RequesterPays reports whether the bucket is a Requester Pays bucket.
	RequesterPays bool
}

func newBucket(b *raw.Bucket) *BucketAttrs {
	if b == nil {
		return nil
	}
	bucket := &BucketAttrs{
		Name:              b.Name,
		Location:          b.Location,
		MetaGeneration:    b.Metageneration,
		StorageClass:      b.StorageClass,
		Created:           convertTime(b.TimeCreated),
		VersioningEnabled: b.Versioning != nil && b.Versioning.Enabled,
		Labels:            b.Labels,
		RequesterPays:     b.Billing != nil && b.Billing.RequesterPays,
	}
	acl := make([]ACLRule, len(b.Acl))
	for i, rule := range b.Acl {
		acl[i] = ACLRule{
			Entity: ACLEntity(rule.Entity),
			Role:   ACLRole(rule.Role),
		}
	}
	bucket.ACL = acl
	objACL := make([]ACLRule, len(b.DefaultObjectAcl))
	for i, rule := range b.DefaultObjectAcl {
		objACL[i] = ACLRule{
			Entity: ACLEntity(rule.Entity),
			Role:   ACLRole(rule.Role),
		}
	}
	bucket.DefaultObjectACL = objACL
	return bucket
}

// toRawBucket copies the editable attribute from b to the raw library's Bucket type.
func (b *BucketAttrs) toRawBucket() *raw.Bucket {
	var acl []*raw.BucketAccessControl
	if len(b.ACL) > 0 {
		acl = make([]*raw.BucketAccessControl, len(b.ACL))
		for i, rule := range b.ACL {
			acl[i] = &raw.BucketAccessControl{
				Entity: string(rule.Entity),
				Role:   string(rule.Role),
			}
		}
	}
	dACL := toRawObjectACL(b.DefaultObjectACL)
	// Copy label map.
	var labels map[string]string
	if len(b.Labels) > 0 {
		labels = make(map[string]string, len(b.Labels))
		for k, v := range b.Labels {
			labels[k] = v
		}
	}
	// Ignore VersioningEnabled if it is false. This is OK because
	// we only call this method when creating a bucket, and by default
	// new buckets have versioning off.
	var v *raw.BucketVersioning
	if b.VersioningEnabled {
		v = &raw.BucketVersioning{Enabled: true}
	}
	var bb *raw.BucketBilling
	if b.RequesterPays {
		bb = &raw.BucketBilling{RequesterPays: true}
	}
	return &raw.Bucket{
		Name:             b.Name,
		DefaultObjectAcl: dACL,
		Location:         b.Location,
		StorageClass:     b.StorageClass,
		Acl:              acl,
		Versioning:       v,
		Labels:           labels,
		Billing:          bb,
	}
}

type BucketAttrsToUpdate struct {
	// VersioningEnabled, if set, updates whether the bucket uses versioning.
	VersioningEnabled optional.Bool

	// RequesterPays, if set, updates whether the bucket is a Requester Pays bucket.
	RequesterPays optional.Bool

	setLabels    map[string]string
	deleteLabels map[string]bool
}

// SetLabel causes a label to be added or modified when ua is used
// in a call to Bucket.Update.
func (ua *BucketAttrsToUpdate) SetLabel(name, value string) {
	if ua.setLabels == nil {
		ua.setLabels = map[string]string{}
	}
	ua.setLabels[name] = value
}

// DeleteLabel causes a label to be deleted when ua is used in a
// call to Bucket.Update.
func (ua *BucketAttrsToUpdate) DeleteLabel(name string) {
	if ua.deleteLabels == nil {
		ua.deleteLabels = map[string]bool{}
	}
	ua.deleteLabels[name] = true
}

func (ua *BucketAttrsToUpdate) toRawBucket() *raw.Bucket {
	rb := &raw.Bucket{}
	if ua.VersioningEnabled != nil {
		rb.Versioning = &raw.BucketVersioning{
			Enabled:         optional.ToBool(ua.VersioningEnabled),
			ForceSendFields: []string{"Enabled"},
		}
	}
	if ua.RequesterPays != nil {
		rb.Billing = &raw.BucketBilling{
			RequesterPays:   optional.ToBool(ua.RequesterPays),
			ForceSendFields: []string{"RequesterPays"},
		}
	}
	if ua.setLabels != nil || ua.deleteLabels != nil {
		rb.Labels = map[string]string{}
		for k, v := range ua.setLabels {
			rb.Labels[k] = v
		}
		if len(rb.Labels) == 0 && len(ua.deleteLabels) > 0 {
			rb.ForceSendFields = append(rb.ForceSendFields, "Labels")
		}
		for l := range ua.deleteLabels {
			rb.NullFields = append(rb.NullFields, "Labels."+l)
		}
	}
	return rb
}

// If returns a new BucketHandle that applies a set of preconditions.
// Preconditions already set on the BucketHandle are ignored.
// Operations on the new handle will only occur if the preconditions are
// satisfied. The only valid preconditions for buckets are MetagenerationMatch
// and MetagenerationNotMatch.
func (b *BucketHandle) If(conds BucketConditions) *BucketHandle {
	b2 := *b
	b2.conds = &conds
	return &b2
}

// BucketConditions constrain bucket methods to act on specific metagenerations.
//
// The zero value is an empty set of constraints.
type BucketConditions struct {
	// MetagenerationMatch specifies that the bucket must have the given
	// metageneration for the operation to occur.
	// If MetagenerationMatch is zero, it has no effect.
	MetagenerationMatch int64

	// MetagenerationNotMatch specifies that the bucket must not have the given
	// metageneration for the operation to occur.
	// If MetagenerationNotMatch is zero, it has no effect.
	MetagenerationNotMatch int64
}

func (c *BucketConditions) validate(method string) error {
	if *c == (BucketConditions{}) {
		return fmt.Errorf("storage: %s: empty conditions", method)
	}
	if c.MetagenerationMatch != 0 && c.MetagenerationNotMatch != 0 {
		return fmt.Errorf("storage: %s: multiple conditions specified for metageneration", method)
	}
	return nil
}

// UserProject returns a new BucketHandle that passes the project ID as the user
// project for all subsequent calls. A user project is required for all operations
// on requester-pays buckets.
func (b *BucketHandle) UserProject(projectID string) *BucketHandle {
	b2 := *b
	b2.userProject = projectID
	b2.acl.userProject = projectID
	b2.defaultObjectACL.userProject = projectID
	return &b2
}

// applyBucketConds modifies the provided call using the conditions in conds.
// call is something that quacks like a *raw.WhateverCall.
func applyBucketConds(method string, conds *BucketConditions, call interface{}) error {
	if conds == nil {
		return nil
	}
	if err := conds.validate(method); err != nil {
		return err
	}
	cval := reflect.ValueOf(call)
	switch {
	case conds.MetagenerationMatch != 0:
		if !setConditionField(cval, "IfMetagenerationMatch", conds.MetagenerationMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationMatch not supported", method)
		}
	case conds.MetagenerationNotMatch != 0:
		if !setConditionField(cval, "IfMetagenerationNotMatch", conds.MetagenerationNotMatch) {
			return fmt.Errorf("storage: %s: ifMetagenerationNotMatch not supported", method)
		}
	}
	return nil
}

// Objects returns an iterator over the objects in the bucket that match the Query q.
// If q is nil, no filtering is done.
func (b *BucketHandle) Objects(ctx context.Context, q *Query) *ObjectIterator {
	it := &ObjectIterator{
		ctx:    ctx,
		bucket: b,
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.items) },
		func() interface{} { b := it.items; it.items = nil; return b })
	if q != nil {
		it.query = *q
	}
	return it
}

// An ObjectIterator is an iterator over ObjectAttrs.
type ObjectIterator struct {
	ctx      context.Context
	bucket   *BucketHandle
	query    Query
	pageInfo *iterator.PageInfo
	nextFunc func() error
	items    []*ObjectAttrs
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *ObjectIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

// Next returns the next result. Its second return value is iterator.Done if
// there are no more results. Once Next returns iterator.Done, all subsequent
// calls will return iterator.Done.
//
// If Query.Delimiter is non-empty, some of the ObjectAttrs returned by Next will
// have a non-empty Prefix field, and a zero value for all other fields. These
// represent prefixes.
func (it *ObjectIterator) Next() (*ObjectAttrs, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	item := it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *ObjectIterator) fetch(pageSize int, pageToken string) (string, error) {
	req := it.bucket.c.raw.Objects.List(it.bucket.name)
	setClientHeader(req.Header())
	req.Projection("full")
	req.Delimiter(it.query.Delimiter)
	req.Prefix(it.query.Prefix)
	req.Versions(it.query.Versions)
	req.PageToken(pageToken)
	if it.bucket.userProject != "" {
		req.UserProject(it.bucket.userProject)
	}
	if pageSize > 0 {
		req.MaxResults(int64(pageSize))
	}
	var resp *raw.Objects
	var err error
	err = runWithRetry(it.ctx, func() error {
		resp, err = req.Context(it.ctx).Do()
		return err
	})
	if err != nil {
		if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusNotFound {
			err = ErrBucketNotExist
		}
		return "", err
	}
	for _, item := range resp.Items {
		it.items = append(it.items, newObject(item))
	}
	for _, prefix := range resp.Prefixes {
		it.items = append(it.items, &ObjectAttrs{Prefix: prefix})
	}
	return resp.NextPageToken, nil
}

// TODO(jbd): Add storage.buckets.update.

// Buckets returns an iterator over the buckets in the project. You may
// optionally set the iterator's Prefix field to restrict the list to buckets
// whose names begin with the prefix. By default, all buckets in the project
// are returned.
func (c *Client) Buckets(ctx context.Context, projectID string) *BucketIterator {
	it := &BucketIterator{
		ctx:       ctx,
		client:    c,
		projectID: projectID,
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.buckets) },
		func() interface{} { b := it.buckets; it.buckets = nil; return b })
	return it
}

// A BucketIterator is an iterator over BucketAttrs.
type BucketIterator struct {
	// Prefix restricts the iterator to buckets whose names begin with it.
	Prefix string

	ctx       context.Context
	client    *Client
	projectID string
	buckets   []*BucketAttrs
	pageInfo  *iterator.PageInfo
	nextFunc  func() error
}

// Next returns the next result. Its second return value is iterator.Done if
// there are no more results. Once Next returns iterator.Done, all subsequent
// calls will return iterator.Done.
func (it *BucketIterator) Next() (*BucketAttrs, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	b := it.buckets[0]
	it.buckets = it.buckets[1:]
	return b, nil
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *BucketIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

func (it *BucketIterator) fetch(pageSize int, pageToken string) (string, error) {
	req := it.client.raw.Buckets.List(it.projectID)
	setClientHeader(req.Header())
	req.Projection("full")
	req.Prefix(it.Prefix)
	req.PageToken(pageToken)
	if pageSize > 0 {
		req.MaxResults(int64(pageSize))
	}
	var resp *raw.Buckets
	var err error
	err = runWithRetry(it.ctx, func() error {
		resp, err = req.Context(it.ctx).Do()
		return err
	})
	if err != nil {
		return "", err
	}
	for _, item := range resp.Items {
		it.buckets = append(it.buckets, newBucket(item))
	}
	return resp.NextPageToken, nil
}
