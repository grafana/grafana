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

	"cloud.google.com/go/storage/internal/apiv2/storagepb"
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
// ACLHandle on an object operates on the latest generation of that object by default.
// Selecting a specific generation of an object is not currently supported by the client.
type ACLHandle struct {
	c           *Client
	bucket      string
	object      string
	isDefault   bool
	userProject string // for requester-pays buckets
	retry       *retryConfig
}

// Delete permanently deletes the ACL entry for the given entity.
func (a *ACLHandle) Delete(ctx context.Context, entity ACLEntity) (err error) {
	ctx, _ = startSpan(ctx, "ACL.Delete")
	defer func() { endSpan(ctx, err) }()

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
	ctx, _ = startSpan(ctx, "ACL.Set")
	defer func() { endSpan(ctx, err) }()

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
	ctx, _ = startSpan(ctx, "ACL.List")
	defer func() { endSpan(ctx, err) }()

	if a.object != "" {
		return a.objectList(ctx)
	}
	if a.isDefault {
		return a.bucketDefaultList(ctx)
	}
	return a.bucketList(ctx)
}

func (a *ACLHandle) bucketDefaultList(ctx context.Context) ([]ACLRule, error) {
	opts := makeStorageOpts(true, a.retry, a.userProject)
	return a.c.tc.ListDefaultObjectACLs(ctx, a.bucket, opts...)
}

func (a *ACLHandle) bucketDefaultDelete(ctx context.Context, entity ACLEntity) error {
	opts := makeStorageOpts(false, a.retry, a.userProject)
	return a.c.tc.DeleteDefaultObjectACL(ctx, a.bucket, entity, opts...)
}

func (a *ACLHandle) bucketList(ctx context.Context) ([]ACLRule, error) {
	opts := makeStorageOpts(true, a.retry, a.userProject)
	return a.c.tc.ListBucketACLs(ctx, a.bucket, opts...)
}

func (a *ACLHandle) bucketSet(ctx context.Context, entity ACLEntity, role ACLRole) error {
	opts := makeStorageOpts(false, a.retry, a.userProject)
	return a.c.tc.UpdateBucketACL(ctx, a.bucket, entity, role, opts...)
}

func (a *ACLHandle) bucketDelete(ctx context.Context, entity ACLEntity) error {
	opts := makeStorageOpts(false, a.retry, a.userProject)
	return a.c.tc.DeleteBucketACL(ctx, a.bucket, entity, opts...)
}

func (a *ACLHandle) objectList(ctx context.Context) ([]ACLRule, error) {
	opts := makeStorageOpts(true, a.retry, a.userProject)
	return a.c.tc.ListObjectACLs(ctx, a.bucket, a.object, opts...)
}

func (a *ACLHandle) objectSet(ctx context.Context, entity ACLEntity, role ACLRole, isBucketDefault bool) error {
	opts := makeStorageOpts(false, a.retry, a.userProject)
	if isBucketDefault {
		return a.c.tc.UpdateDefaultObjectACL(ctx, a.bucket, entity, role, opts...)
	}
	return a.c.tc.UpdateObjectACL(ctx, a.bucket, a.object, entity, role, opts...)
}

func (a *ACLHandle) objectDelete(ctx context.Context, entity ACLEntity) error {
	opts := makeStorageOpts(false, a.retry, a.userProject)
	return a.c.tc.DeleteObjectACL(ctx, a.bucket, a.object, entity, opts...)
}

func toObjectACLRules(items []*raw.ObjectAccessControl) []ACLRule {
	var rs []ACLRule
	for _, item := range items {
		rs = append(rs, toObjectACLRule(item))
	}
	return rs
}

func toObjectACLRulesFromProto(items []*storagepb.ObjectAccessControl) []ACLRule {
	var rs []ACLRule
	for _, item := range items {
		rs = append(rs, toObjectACLRuleFromProto(item))
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

func toBucketACLRulesFromProto(items []*storagepb.BucketAccessControl) []ACLRule {
	var rs []ACLRule
	for _, item := range items {
		rs = append(rs, toBucketACLRuleFromProto(item))
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

func toObjectACLRuleFromProto(a *storagepb.ObjectAccessControl) ACLRule {
	return ACLRule{
		Entity:      ACLEntity(a.GetEntity()),
		EntityID:    a.GetEntityId(),
		Role:        ACLRole(a.GetRole()),
		Domain:      a.GetDomain(),
		Email:       a.GetEmail(),
		ProjectTeam: toProjectTeamFromProto(a.GetProjectTeam()),
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

func toBucketACLRuleFromProto(a *storagepb.BucketAccessControl) ACLRule {
	return ACLRule{
		Entity:      ACLEntity(a.GetEntity()),
		EntityID:    a.GetEntityId(),
		Role:        ACLRole(a.GetRole()),
		Domain:      a.GetDomain(),
		Email:       a.GetEmail(),
		ProjectTeam: toProjectTeamFromProto(a.GetProjectTeam()),
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

func toProtoObjectACL(rules []ACLRule) []*storagepb.ObjectAccessControl {
	if len(rules) == 0 {
		return nil
	}
	r := make([]*storagepb.ObjectAccessControl, 0, len(rules))
	for _, rule := range rules {
		r = append(r, rule.toProtoObjectAccessControl("")) // bucket name unnecessary
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

func toProtoBucketACL(rules []ACLRule) []*storagepb.BucketAccessControl {
	if len(rules) == 0 {
		return nil
	}
	r := make([]*storagepb.BucketAccessControl, 0, len(rules))
	for _, rule := range rules {
		r = append(r, rule.toProtoBucketAccessControl())
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

func (r ACLRule) toProtoObjectAccessControl(bucket string) *storagepb.ObjectAccessControl {
	return &storagepb.ObjectAccessControl{
		Entity: string(r.Entity),
		Role:   string(r.Role),
		// The other fields are not settable.
	}
}

func (r ACLRule) toProtoBucketAccessControl() *storagepb.BucketAccessControl {
	return &storagepb.BucketAccessControl{
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

func toProjectTeamFromProto(p *storagepb.ProjectTeam) *ProjectTeam {
	if p == nil {
		return nil
	}
	return &ProjectTeam{
		ProjectNumber: p.GetProjectNumber(),
		Team:          p.GetTeam(),
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
