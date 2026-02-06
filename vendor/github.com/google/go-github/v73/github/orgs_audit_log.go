// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
)

// GetAuditLogOptions sets up optional parameters to query audit-log endpoint.
type GetAuditLogOptions struct {
	Phrase  *string `url:"phrase,omitempty"`  // A search phrase. (Optional.)
	Include *string `url:"include,omitempty"` // Event type includes. Can be one of "web", "git", "all". Default: "web". (Optional.)
	Order   *string `url:"order,omitempty"`   // The order of audit log events. Can be one of "asc" or "desc". Default: "desc". (Optional.)

	ListCursorOptions
}

// ActorLocation contains information about reported location for an actor.
type ActorLocation struct {
	CountryCode *string `json:"country_code,omitempty"`
}

// AuditEntry describes the fields that may be represented by various audit-log "action" entries.
// There are many other fields that may be present depending on the action. You can access those
// in AdditionalFields.
// For a list of actions see - https://docs.github.com/github/setting-up-and-managing-organizations-and-teams/reviewing-the-audit-log-for-your-organization#audit-log-actions
type AuditEntry struct {
	Action                   *string        `json:"action,omitempty"` // The name of the action that was performed, for example `user.login` or `repo.create`.
	Actor                    *string        `json:"actor,omitempty"`  // The actor who performed the action.
	ActorID                  *int64         `json:"actor_id,omitempty"`
	ActorLocation            *ActorLocation `json:"actor_location,omitempty"`
	Business                 *string        `json:"business,omitempty"`
	BusinessID               *int64         `json:"business_id,omitempty"`
	CreatedAt                *Timestamp     `json:"created_at,omitempty"`
	DocumentID               *string        `json:"_document_id,omitempty"`
	ExternalIdentityNameID   *string        `json:"external_identity_nameid,omitempty"`
	ExternalIdentityUsername *string        `json:"external_identity_username,omitempty"`
	HashedToken              *string        `json:"hashed_token,omitempty"`
	Org                      *string        `json:"org,omitempty"`
	OrgID                    *int64         `json:"org_id,omitempty"`
	Timestamp                *Timestamp     `json:"@timestamp,omitempty"` // The time the audit log event occurred, given as a [Unix timestamp](http://en.wikipedia.org/wiki/Unix_time).
	TokenID                  *int64         `json:"token_id,omitempty"`
	TokenScopes              *string        `json:"token_scopes,omitempty"`
	User                     *string        `json:"user,omitempty"` // The user that was affected by the action performed (if available).
	UserID                   *int64         `json:"user_id,omitempty"`

	// Some events types have a data field that contains additional information about the event.
	Data map[string]any `json:"data,omitempty"`

	// All fields that are not explicitly defined in the struct are captured here.
	AdditionalFields map[string]any `json:"-"`
}

func (a *AuditEntry) UnmarshalJSON(data []byte) error {
	type entryAlias AuditEntry
	var v entryAlias
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}

	rawDefinedFields, err := json.Marshal(v)
	if err != nil {
		return err
	}
	definedFields := map[string]any{}
	if err := json.Unmarshal(rawDefinedFields, &definedFields); err != nil {
		return err
	}

	if err := json.Unmarshal(data, &v.AdditionalFields); err != nil {
		return err
	}

	for key, val := range v.AdditionalFields {
		if _, ok := definedFields[key]; ok || val == nil {
			delete(v.AdditionalFields, key)
		}
	}

	*a = AuditEntry(v)
	if len(v.AdditionalFields) == 0 {
		a.AdditionalFields = nil
	}
	return nil
}

func (a *AuditEntry) MarshalJSON() ([]byte, error) {
	type entryAlias AuditEntry
	v := entryAlias(*a)
	defBytes, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	if len(a.AdditionalFields) == 0 {
		return defBytes, err
	}
	resMap := map[string]any{}
	if err := json.Unmarshal(defBytes, &resMap); err != nil {
		return nil, err
	}
	for key, val := range a.AdditionalFields {
		if val == nil {
			continue
		}
		if _, ok := resMap[key]; ok {
			return nil, fmt.Errorf("unexpected field in AdditionalFields: %v", key)
		}
		resMap[key] = val
	}
	return json.Marshal(resMap)
}

// GetAuditLog gets the audit-log entries for an organization.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/orgs#get-the-audit-log-for-an-organization
//
//meta:operation GET /orgs/{org}/audit-log
func (s *OrganizationsService) GetAuditLog(ctx context.Context, org string, opts *GetAuditLogOptions) ([]*AuditEntry, *Response, error) {
	u := fmt.Sprintf("orgs/%v/audit-log", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var auditEntries []*AuditEntry
	resp, err := s.client.Do(ctx, req, &auditEntries)
	if err != nil {
		return nil, resp, err
	}

	return auditEntries, resp, nil
}
