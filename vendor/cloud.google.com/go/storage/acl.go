// Copyright 2014 Google LLC
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
	"net/http"
	"reflect"

	"cloud.google.com/go/internal/trace"
	"google.golang.org/api/googleapi"
	raw "google.golang.org/api/storage/v1"
)

// ACLRole is the level of access to grant.
type ACLRole string

const (
	RoleOwner  ACLRole = "OWNER"
	RoleReader ACLRole = "READER"
	RoleWriter ACLRole = "WRITER"
)

// ACLEntity refers to a user or group.
// They are sometimes referred to as grantees.
//
// It could be in the form of:
// "user-<userId>", "user-<email>", "group-<groupId>", "group-<email>",
// "domain-<domain>" and "project-team-<projectId>".
//
// Or one of the predefined constants: AllUsers, AllAuthenticatedUsers.
type ACLEntity string

const (
	AllUsers              ACLEntity = "allUsers"
	AllAuthenticatedUsers ACLEntity = "allAuthenticatedUsers"
)

// ACLRule represents a grant for a role to an entity (user, group or team) for a
// Google Cloud Storage object or bucket.
type ACLRule struct {
	Entity      ACLEntity
	EntityID    string
	Role        ACLRole
	Domain      string
	Email       string
	ProjectTeam *ProjectTeam
}

// ProjectTeam is the project team associated with the entity, if any.
type ProjectTeam struct {
	ProjectNumber string
	Team          string
}

// ACLHandle provides operations on an access control list for a Google Cloud Storage bucket or object.
type ACLHandle struct {
	c           *Client
	bucket      string
	object      string
	isDefault   bool
	userProject string // for requester-pays buckets
}

// Delete permanently deletes the ACL entry for the given entity.
func (a *ACLHandle) Delete(ctx context.Context, entity ACLEntity) (err error) {
	ctx = trace.StartSpan(ctx, "cloud.google.com/go/storage.ACL.Delete")
	defer func() { trace.EndSpan(ctx, err) }()

	if a.object != "" {
		return a.objectDelete(ctx, entity)
	}
	if a.isDefault {
		return a.bucketDefaultDelete(ctx, entity)
	}
	return a.bucketDelete(ctx, entity)
}

// Set sets the role for the given entity.
func (a *ACLHandle) Set(ctx context.Context, entity ACLEntity, role ACLRole) (err error) {
	ctx = trace.StartSpan(ctx, "cloud.google.com/go/storage.ACL.Set")
	defer func() { trace.EndSpan(ctx, err) }()

	if a.object != "" {
		return a.objectSet(ctx, entity, role, false)
	}
	if a.isDefault {
		return a.objectSet(ctx, entity, role, true)
	}
	return a.bucketSet(ctx, entity, role)
}

// List retrieves ACL entries.
func (a *ACLHandle) List(ctx context.Context) (rules []ACLRule, err error) {
	ctx = trace.StartSpan(ctx, "cloud.google.com/go/storage.ACL.List")
	defer func() { trace.EndSpan(ctx, err) }()

	if a.object != "" {
		return a.objectList(ctx)
	}
	if a.isDefault {
		return a.bucketDefaultList(ctx)
	}
	return a.bucketList(ctx)
}

func (a *ACLHandle) bucketDefaultList(ctx context.Context) ([]ACLRule, error) {
	var acls *raw.ObjectAccessControls
	var err error
	err = runWithRetry(ctx, func() error {
		req := a.c.raw.DefaultObjectAccessControls.List(a.bucket)
		a.configureCall(ctx, req)
		acls, err = req.Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return toObjectACLRules(acls.Items), nil
}

func (a *ACLHandle) bucketDefaultDelete(ctx context.Context, entity ACLEntity) error {
	return runWithRetry(ctx, func() error {
		req := a.c.raw.DefaultObjectAccessControls.Delete(a.bucket, string(entity))
		a.configureCall(ctx, req)
		return req.Do()
	})
}

func (a *ACLHandle) bucketList(ctx context.Context) ([]ACLRule, error) {
	var acls *raw.BucketAccessControls
	var err error
	err = runWithRetry(ctx, func() error {
		req := a.c.raw.BucketAccessControls.List(a.bucket)
		a.configureCall(ctx, req)
		acls, err = req.Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return toBucketACLRules(acls.Items), nil
}

func (a *ACLHandle) bucketSet(ctx context.Context, entity ACLEntity, role ACLRole) error {
	acl := &raw.BucketAccessControl{
		Bucket: a.bucket,
		Entity: string(entity),
		Role:   string(role),
	}
	err := runWithRetry(ctx, func() error {
		req := a.c.raw.BucketAccessControls.Update(a.bucket, string(entity), acl)
		a.configureCall(ctx, req)
		_, err := req.Do()
		return err
	})
	if err != nil {
		return err
	}
	return nil
}

func (a *ACLHandle) bucketDelete(ctx context.Context, entity ACLEntity) error {
	return runWithRetry(ctx, func() error {
		req := a.c.raw.BucketAccessControls.Delete(a.bucket, string(entity))
		a.configureCall(ctx, req)
		return req.Do()
	})
}

func (a *ACLHandle) objectList(ctx context.Context) ([]ACLRule, error) {
	var acls *raw.ObjectAccessControls
	var err error
	err = runWithRetry(ctx, func() error {
		req := a.c.raw.ObjectAccessControls.List(a.bucket, a.object)
		a.configureCall(ctx, req)
		acls, err = req.Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return toObjectACLRules(acls.Items), nil
}

func (a *ACLHandle) objectSet(ctx context.Context, entity ACLEntity, role ACLRole, isBucketDefault bool) error {
	type setRequest interface {
		Do(opts ...googleapi.CallOption) (*raw.ObjectAccessControl, error)
		Header() http.Header
	}

	acl := &raw.ObjectAccessControl{
		Bucket: a.bucket,
		Entity: string(entity),
		Role:   string(role),
	}
	var req setRequest
	if isBucketDefault {
		req = a.c.raw.DefaultObjectAccessControls.Update(a.bucket, string(entity), acl)
	} else {
		req = a.c.raw.ObjectAccessControls.Update(a.bucket, a.object, string(entity), acl)
	}
	a.configureCall(ctx, req)
	return runWithRetry(ctx, func() error {
		_, err := req.Do()
		return err
	})
}

func (a *ACLHandle) objectDelete(ctx context.Context, entity ACLEntity) error {
	return runWithRetry(ctx, func() error {
		req := a.c.raw.ObjectAccessControls.Delete(a.bucket, a.object, string(entity))
		a.configureCall(ctx, req)
		return req.Do()
	})
}

func (a *ACLHandle) configureCall(ctx context.Context, call interface{ Header() http.Header }) {
	vc := reflect.ValueOf(call)
	vc.MethodByName("Context").Call([]reflect.Value{reflect.ValueOf(ctx)})
	if a.userProject != "" {
		vc.MethodByName("UserProject").Call([]reflect.Value{reflect.ValueOf(a.userProject)})
	}
	setClientHeader(call.Header())
}

func toObjectACLRules(items []*raw.ObjectAccessControl) []ACLRule {
	var rs []ACLRule
	for _, item := range items {
		rs = append(rs, toObjectACLRule(item))
	}
	return rs
}

func toBucketACLRules(items []*raw.BucketAccessControl) []ACLRule {
	var rs []ACLRule
	for _, item := range items {
		rs = append(rs, toBucketACLRule(item))
	}
	return rs
}

func toObjectACLRule(a *raw.ObjectAccessControl) ACLRule {
	return ACLRule{
		Entity:      ACLEntity(a.Entity),
		EntityID:    a.EntityId,
		Role:        ACLRole(a.Role),
		Domain:      a.Domain,
		Email:       a.Email,
		ProjectTeam: toObjectProjectTeam(a.ProjectTeam),
	}
}

func toBucketACLRule(a *raw.BucketAccessControl) ACLRule {
	return ACLRule{
		Entity:      ACLEntity(a.Entity),
		EntityID:    a.EntityId,
		Role:        ACLRole(a.Role),
		Domain:      a.Domain,
		Email:       a.Email,
		ProjectTeam: toBucketProjectTeam(a.ProjectTeam),
	}
}

func toRawObjectACL(rules []ACLRule) []*raw.ObjectAccessControl {
	if len(rules) == 0 {
		return nil
	}
	r := make([]*raw.ObjectAccessControl, 0, len(rules))
	for _, rule := range rules {
		r = append(r, rule.toRawObjectAccessControl("")) // bucket name unnecessary
	}
	return r
}

func toRawBucketACL(rules []ACLRule) []*raw.BucketAccessControl {
	if len(rules) == 0 {
		return nil
	}
	r := make([]*raw.BucketAccessControl, 0, len(rules))
	for _, rule := range rules {
		r = append(r, rule.toRawBucketAccessControl("")) // bucket name unnecessary
	}
	return r
}

func (r ACLRule) toRawBucketAccessControl(bucket string) *raw.BucketAccessControl {
	return &raw.BucketAccessControl{
		Bucket: bucket,
		Entity: string(r.Entity),
		Role:   string(r.Role),
		// The other fields are not settable.
	}
}

func (r ACLRule) toRawObjectAccessControl(bucket string) *raw.ObjectAccessControl {
	return &raw.ObjectAccessControl{
		Bucket: bucket,
		Entity: string(r.Entity),
		Role:   string(r.Role),
		// The other fields are not settable.
	}
}

func toBucketProjectTeam(p *raw.BucketAccessControlProjectTeam) *ProjectTeam {
	if p == nil {
		return nil
	}
	return &ProjectTeam{
		ProjectNumber: p.ProjectNumber,
		Team:          p.Team,
	}
}

func toObjectProjectTeam(p *raw.ObjectAccessControlProjectTeam) *ProjectTeam {
	if p == nil {
		return nil
	}
	return &ProjectTeam{
		ProjectNumber: p.ProjectNumber,
		Team:          p.Team,
	}
}
