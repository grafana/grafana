// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/url"
)

// ListPackages lists the packages for an organization.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#list-packages-for-an-organization
//
//meta:operation GET /orgs/{org}/packages
func (s *OrganizationsService) ListPackages(ctx context.Context, org string, opts *PackageListOptions) ([]*Package, *Response, error) {
	u := fmt.Sprintf("orgs/%v/packages", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var packages []*Package
	resp, err := s.client.Do(ctx, req, &packages)
	if err != nil {
		return nil, resp, err
	}

	return packages, resp, nil
}

// GetPackage gets a package by name from an organization.
//
// Note that packageName is escaped for the URL path so that you don't need to.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#get-a-package-for-an-organization
//
//meta:operation GET /orgs/{org}/packages/{package_type}/{package_name}
func (s *OrganizationsService) GetPackage(ctx context.Context, org, packageType, packageName string) (*Package, *Response, error) {
	u := fmt.Sprintf("orgs/%v/packages/%v/%v", org, packageType, url.PathEscape(packageName))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var pack *Package
	resp, err := s.client.Do(ctx, req, &pack)
	if err != nil {
		return nil, resp, err
	}

	return pack, resp, nil
}

// DeletePackage deletes a package from an organization.
//
// Note that packageName is escaped for the URL path so that you don't need to.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#delete-a-package-for-an-organization
//
//meta:operation DELETE /orgs/{org}/packages/{package_type}/{package_name}
func (s *OrganizationsService) DeletePackage(ctx context.Context, org, packageType, packageName string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/packages/%v/%v", org, packageType, url.PathEscape(packageName))
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RestorePackage restores a package to an organization.
//
// Note that packageName is escaped for the URL path so that you don't need to.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#restore-a-package-for-an-organization
//
//meta:operation POST /orgs/{org}/packages/{package_type}/{package_name}/restore
func (s *OrganizationsService) RestorePackage(ctx context.Context, org, packageType, packageName string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/packages/%v/%v/restore", org, packageType, url.PathEscape(packageName))
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// PackageGetAllVersions gets all versions of a package in an organization.
//
// Note that packageName is escaped for the URL path so that you don't need to.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#list-package-versions-for-a-package-owned-by-an-organization
//
//meta:operation GET /orgs/{org}/packages/{package_type}/{package_name}/versions
func (s *OrganizationsService) PackageGetAllVersions(ctx context.Context, org, packageType, packageName string, opts *PackageListOptions) ([]*PackageVersion, *Response, error) {
	u := fmt.Sprintf("orgs/%v/packages/%v/%v/versions", org, packageType, url.PathEscape(packageName))
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var versions []*PackageVersion
	resp, err := s.client.Do(ctx, req, &versions)
	if err != nil {
		return nil, resp, err
	}

	return versions, resp, nil
}

// PackageGetVersion gets a specific version of a package in an organization.
//
// Note that packageName is escaped for the URL path so that you don't need to.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#get-a-package-version-for-an-organization
//
//meta:operation GET /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}
func (s *OrganizationsService) PackageGetVersion(ctx context.Context, org, packageType, packageName string, packageVersionID int64) (*PackageVersion, *Response, error) {
	u := fmt.Sprintf("orgs/%v/packages/%v/%v/versions/%v", org, packageType, url.PathEscape(packageName), packageVersionID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var version *PackageVersion
	resp, err := s.client.Do(ctx, req, &version)
	if err != nil {
		return nil, resp, err
	}

	return version, resp, nil
}

// PackageDeleteVersion deletes a package version from an organization.
//
// Note that packageName is escaped for the URL path so that you don't need to.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#delete-package-version-for-an-organization
//
//meta:operation DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}
func (s *OrganizationsService) PackageDeleteVersion(ctx context.Context, org, packageType, packageName string, packageVersionID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/packages/%v/%v/versions/%v", org, packageType, url.PathEscape(packageName), packageVersionID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// PackageRestoreVersion restores a package version to an organization.
//
// Note that packageName is escaped for the URL path so that you don't need to.
//
// GitHub API docs: https://docs.github.com/rest/packages/packages#restore-package-version-for-an-organization
//
//meta:operation POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore
func (s *OrganizationsService) PackageRestoreVersion(ctx context.Context, org, packageType, packageName string, packageVersionID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/packages/%v/%v/versions/%v/restore", org, packageType, url.PathEscape(packageName), packageVersionID)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
