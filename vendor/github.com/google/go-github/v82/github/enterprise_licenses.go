// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// EnterpriseConsumedLicenses represents information about users with consumed enterprise licenses.
type EnterpriseConsumedLicenses struct {
	TotalSeatsConsumed  int                        `json:"total_seats_consumed"`
	TotalSeatsPurchased int                        `json:"total_seats_purchased"`
	Users               []*EnterpriseLicensedUsers `json:"users,omitempty"`
}

// EnterpriseLicensedUsers represents a user with license information in an enterprise.
type EnterpriseLicensedUsers struct {
	GithubComLogin                  string   `json:"github_com_login"`
	GithubComName                   *string  `json:"github_com_name"`
	EnterpriseServerUserIDs         []string `json:"enterprise_server_user_ids,omitempty"`
	GithubComUser                   bool     `json:"github_com_user"`
	EnterpriseServerUser            *bool    `json:"enterprise_server_user"`
	VisualStudioSubscriptionUser    bool     `json:"visual_studio_subscription_user"`
	LicenseType                     string   `json:"license_type"`
	GithubComProfile                *string  `json:"github_com_profile"`
	GithubComMemberRoles            []string `json:"github_com_member_roles,omitempty"`
	GithubComEnterpriseRoles        []string `json:"github_com_enterprise_roles,omitempty"`
	GithubComVerifiedDomainEmails   []string `json:"github_com_verified_domain_emails,omitempty"`
	GithubComSamlNameID             *string  `json:"github_com_saml_name_id"`
	GithubComOrgsWithPendingInvites []string `json:"github_com_orgs_with_pending_invites,omitempty"`
	GithubComTwoFactorAuth          *bool    `json:"github_com_two_factor_auth"`
	EnterpriseServerEmails          []string `json:"enterprise_server_emails,omitempty"`
	VisualStudioLicenseStatus       *string  `json:"visual_studio_license_status"`
	VisualStudioSubscriptionEmail   *string  `json:"visual_studio_subscription_email"`
	TotalUserAccounts               int      `json:"total_user_accounts"`
}

// EnterpriseLicenseSyncStatus represents the synchronization status of
// GitHub Enterprise Server instances with an enterprise account.
type EnterpriseLicenseSyncStatus struct {
	Title       string                    `json:"title"`
	Description string                    `json:"description"`
	Properties  *ServerInstanceProperties `json:"properties,omitempty"`
}

// ServerInstanceProperties contains the collection of server instances.
type ServerInstanceProperties struct {
	ServerInstances *ServerInstances `json:"server_instances,omitempty"`
}

// ServerInstances represents a collection of GitHub Enterprise Server instances
// and their synchronization status.
type ServerInstances struct {
	Type  string                `json:"type"`
	Items *ServiceInstanceItems `json:"items,omitempty"`
}

// ServiceInstanceItems defines the structure and properties of individual server instances
// in the collection.
type ServiceInstanceItems struct {
	Type       string                `json:"type"`
	Properties *ServerItemProperties `json:"properties,omitempty"`
}

// ServerItemProperties represents the properties of a GitHub Enterprise Server instance,
// including its identifier, hostname, and last synchronization status.
type ServerItemProperties struct {
	ServerID string           `json:"server_id"`
	Hostname string           `json:"hostname"`
	LastSync *LastLicenseSync `json:"last_sync,omitempty"`
}

// LastLicenseSync contains information about the most recent license synchronization
// attempt for a server instance.
type LastLicenseSync struct {
	Type       string                     `json:"type"`
	Properties *LastLicenseSyncProperties `json:"properties,omitempty"`
}

// LastLicenseSyncProperties represents the details of the last synchronization attempt,
// including the date, status, and any error that occurred.
type LastLicenseSyncProperties struct {
	Date   *Timestamp `json:"date,omitempty"`
	Status string     `json:"status"`
	Error  string     `json:"error"`
}

// GetConsumedLicenses collect information about the number of consumed licenses and a collection with all the users with consumed enterprise licenses.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/licensing#list-enterprise-consumed-licenses
//
//meta:operation GET /enterprises/{enterprise}/consumed-licenses
func (s *EnterpriseService) GetConsumedLicenses(ctx context.Context, enterprise string, opts *ListOptions) (*EnterpriseConsumedLicenses, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/consumed-licenses", enterprise)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	consumedLicenses := &EnterpriseConsumedLicenses{}
	resp, err := s.client.Do(ctx, req, &consumedLicenses)
	if err != nil {
		return nil, resp, err
	}

	return consumedLicenses, resp, nil
}

// GetLicenseSyncStatus collects information about the status of a license sync job for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/licensing#get-a-license-sync-status
//
//meta:operation GET /enterprises/{enterprise}/license-sync-status
func (s *EnterpriseService) GetLicenseSyncStatus(ctx context.Context, enterprise string) (*EnterpriseLicenseSyncStatus, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/license-sync-status", enterprise)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	syncStatus := &EnterpriseLicenseSyncStatus{}
	resp, err := s.client.Do(ctx, req, &syncStatus)
	if err != nil {
		return nil, resp, err
	}

	return syncStatus, resp, nil
}
