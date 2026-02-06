// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// BillingService provides access to the billing related functions
// in the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/billing
type BillingService service

// ActionBilling represents a GitHub Action billing.
type ActionBilling struct {
	TotalMinutesUsed     float64              `json:"total_minutes_used"`
	TotalPaidMinutesUsed float64              `json:"total_paid_minutes_used"`
	IncludedMinutes      float64              `json:"included_minutes"`
	MinutesUsedBreakdown MinutesUsedBreakdown `json:"minutes_used_breakdown"`
}

// MinutesUsedBreakdown counts the actions minutes used by machine type (e.g. UBUNTU, WINDOWS, MACOS).
type MinutesUsedBreakdown = map[string]int

// PackageBilling represents a GitHub Package billing.
type PackageBilling struct {
	TotalGigabytesBandwidthUsed     int     `json:"total_gigabytes_bandwidth_used"`
	TotalPaidGigabytesBandwidthUsed int     `json:"total_paid_gigabytes_bandwidth_used"`
	IncludedGigabytesBandwidth      float64 `json:"included_gigabytes_bandwidth"`
}

// StorageBilling represents a GitHub Storage billing.
type StorageBilling struct {
	DaysLeftInBillingCycle       int     `json:"days_left_in_billing_cycle"`
	EstimatedPaidStorageForMonth float64 `json:"estimated_paid_storage_for_month"`
	EstimatedStorageForMonth     float64 `json:"estimated_storage_for_month"`
}

// ActiveCommitters represents the total active committers across all repositories in an Organization.
type ActiveCommitters struct {
	TotalAdvancedSecurityCommitters     int                           `json:"total_advanced_security_committers"`
	TotalCount                          int                           `json:"total_count"`
	MaximumAdvancedSecurityCommitters   int                           `json:"maximum_advanced_security_committers"`
	PurchasedAdvancedSecurityCommitters int                           `json:"purchased_advanced_security_committers"`
	Repositories                        []*RepositoryActiveCommitters `json:"repositories,omitempty"`
}

// RepositoryActiveCommitters represents active committers on each repository.
type RepositoryActiveCommitters struct {
	Name                                *string                                `json:"name,omitempty"`
	AdvancedSecurityCommitters          *int                                   `json:"advanced_security_committers,omitempty"`
	AdvancedSecurityCommittersBreakdown []*AdvancedSecurityCommittersBreakdown `json:"advanced_security_committers_breakdown,omitempty"`
}

// AdvancedSecurityCommittersBreakdown represents the user activity breakdown for ActiveCommitters.
type AdvancedSecurityCommittersBreakdown struct {
	UserLogin      *string `json:"user_login,omitempty"`
	LastPushedDate *string `json:"last_pushed_date,omitempty"`
}

// GetActionsBillingOrg returns the summary of the free and paid GitHub Actions minutes used for an Org.
//
// GitHub API docs: https://docs.github.com/rest/billing/billing#get-github-actions-billing-for-an-organization
//
//meta:operation GET /orgs/{org}/settings/billing/actions
func (s *BillingService) GetActionsBillingOrg(ctx context.Context, org string) (*ActionBilling, *Response, error) {
	u := fmt.Sprintf("orgs/%v/settings/billing/actions", org)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	actionsOrgBilling := new(ActionBilling)
	resp, err := s.client.Do(ctx, req, actionsOrgBilling)
	if err != nil {
		return nil, resp, err
	}

	return actionsOrgBilling, resp, nil
}

// GetPackagesBillingOrg returns the free and paid storage used for GitHub Packages in gigabytes for an Org.
//
// GitHub API docs: https://docs.github.com/rest/billing/billing#get-github-packages-billing-for-an-organization
//
//meta:operation GET /orgs/{org}/settings/billing/packages
func (s *BillingService) GetPackagesBillingOrg(ctx context.Context, org string) (*PackageBilling, *Response, error) {
	u := fmt.Sprintf("orgs/%v/settings/billing/packages", org)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	packagesOrgBilling := new(PackageBilling)
	resp, err := s.client.Do(ctx, req, packagesOrgBilling)
	if err != nil {
		return nil, resp, err
	}

	return packagesOrgBilling, resp, nil
}

// GetStorageBillingOrg returns the estimated paid and estimated total storage used for GitHub Actions
// and GitHub Packages in gigabytes for an Org.
//
// GitHub API docs: https://docs.github.com/rest/billing/billing#get-shared-storage-billing-for-an-organization
//
//meta:operation GET /orgs/{org}/settings/billing/shared-storage
func (s *BillingService) GetStorageBillingOrg(ctx context.Context, org string) (*StorageBilling, *Response, error) {
	u := fmt.Sprintf("orgs/%v/settings/billing/shared-storage", org)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	storageOrgBilling := new(StorageBilling)
	resp, err := s.client.Do(ctx, req, storageOrgBilling)
	if err != nil {
		return nil, resp, err
	}

	return storageOrgBilling, resp, nil
}

// GetAdvancedSecurityActiveCommittersOrg returns the GitHub Advanced Security active committers for an organization per repository.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/billing/billing#get-github-advanced-security-active-committers-for-an-organization
//
//meta:operation GET /orgs/{org}/settings/billing/advanced-security
func (s *BillingService) GetAdvancedSecurityActiveCommittersOrg(ctx context.Context, org string, opts *ListOptions) (*ActiveCommitters, *Response, error) {
	u := fmt.Sprintf("orgs/%v/settings/billing/advanced-security", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	activeOrgCommitters := new(ActiveCommitters)
	resp, err := s.client.Do(ctx, req, activeOrgCommitters)
	if err != nil {
		return nil, resp, err
	}

	return activeOrgCommitters, resp, nil
}

// GetActionsBillingUser returns the summary of the free and paid GitHub Actions minutes used for a user.
//
// GitHub API docs: https://docs.github.com/rest/billing/billing#get-github-actions-billing-for-a-user
//
//meta:operation GET /users/{username}/settings/billing/actions
func (s *BillingService) GetActionsBillingUser(ctx context.Context, user string) (*ActionBilling, *Response, error) {
	u := fmt.Sprintf("users/%v/settings/billing/actions", user)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	actionsUserBilling := new(ActionBilling)
	resp, err := s.client.Do(ctx, req, actionsUserBilling)
	if err != nil {
		return nil, resp, err
	}

	return actionsUserBilling, resp, nil
}

// GetPackagesBillingUser returns the free and paid storage used for GitHub Packages in gigabytes for a user.
//
// GitHub API docs: https://docs.github.com/rest/billing/billing#get-github-packages-billing-for-a-user
//
//meta:operation GET /users/{username}/settings/billing/packages
func (s *BillingService) GetPackagesBillingUser(ctx context.Context, user string) (*PackageBilling, *Response, error) {
	u := fmt.Sprintf("users/%v/settings/billing/packages", user)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	packagesUserBilling := new(PackageBilling)
	resp, err := s.client.Do(ctx, req, packagesUserBilling)
	if err != nil {
		return nil, resp, err
	}

	return packagesUserBilling, resp, nil
}

// GetStorageBillingUser returns the estimated paid and estimated total storage used for GitHub Actions
// and GitHub Packages in gigabytes for a user.
//
// GitHub API docs: https://docs.github.com/rest/billing/billing#get-shared-storage-billing-for-a-user
//
//meta:operation GET /users/{username}/settings/billing/shared-storage
func (s *BillingService) GetStorageBillingUser(ctx context.Context, user string) (*StorageBilling, *Response, error) {
	u := fmt.Sprintf("users/%v/settings/billing/shared-storage", user)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	storageUserBilling := new(StorageBilling)
	resp, err := s.client.Do(ctx, req, storageUserBilling)
	if err != nil {
		return nil, resp, err
	}

	return storageUserBilling, resp, nil
}
