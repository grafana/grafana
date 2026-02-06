// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
)

// GetActionsAllowed gets the actions that are allowed in an organization.
//
// Deprecated: please use `client.Actions.GetActionsAllowed` instead.
//
// GitHub API docs: https://docs.github.com/rest/actions/permissions#get-allowed-actions-and-reusable-workflows-for-an-organization
//
//meta:operation GET /orgs/{org}/actions/permissions/selected-actions
func (s *OrganizationsService) GetActionsAllowed(ctx context.Context, org string) (*ActionsAllowed, *Response, error) {
	s2 := (*ActionsService)(s)
	return s2.GetActionsAllowed(ctx, org)
}

// EditActionsAllowed sets the actions that are allowed in an organization.
//
// Deprecated: please use `client.Actions.EditActionsAllowed` instead.
//
// GitHub API docs: https://docs.github.com/rest/actions/permissions#set-allowed-actions-and-reusable-workflows-for-an-organization
//
//meta:operation PUT /orgs/{org}/actions/permissions/selected-actions
func (s *OrganizationsService) EditActionsAllowed(ctx context.Context, org string, actionsAllowed ActionsAllowed) (*ActionsAllowed, *Response, error) {
	s2 := (*ActionsService)(s)
	return s2.EditActionsAllowed(ctx, org, actionsAllowed)
}
