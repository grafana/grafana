// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
)

// NodeQueryOptions specifies the optional parameters to the EnterpriseService
// Node management APIs.
type NodeQueryOptions struct {
	// UUID filters issues based on the node UUID.
	UUID *string `url:"uuid,omitempty"`

	// ClusterRoles filters the cluster roles from the cluster configuration file.
	ClusterRoles *string `url:"cluster_roles,omitempty"`
}

// ClusterStatus represents a response from the ClusterStatus and ReplicationStatus methods.
type ClusterStatus struct {
	Status *string              `json:"status,omitempty"`
	Nodes  []*ClusterStatusNode `json:"nodes"`
}

// ClusterStatusNode represents the status of a cluster node.
type ClusterStatusNode struct {
	Hostname *string                         `json:"hostname,omitempty"`
	Status   *string                         `json:"status,omitempty"`
	Services []*ClusterStatusNodeServiceItem `json:"services"`
}

// ClusterStatusNodeServiceItem represents the status of a service running on a cluster node.
type ClusterStatusNodeServiceItem struct {
	Status  *string `json:"status,omitempty"`
	Name    *string `json:"name,omitempty"`
	Details *string `json:"details,omitempty"`
}

// SystemRequirements represents a response from the CheckSystemRequirements method.
type SystemRequirements struct {
	Status *string                   `json:"status,omitempty"`
	Nodes  []*SystemRequirementsNode `json:"nodes"`
}

// SystemRequirementsNode represents the status of a system node.
type SystemRequirementsNode struct {
	Hostname    *string                             `json:"hostname,omitempty"`
	Status      *string                             `json:"status,omitempty"`
	RolesStatus []*SystemRequirementsNodeRoleStatus `json:"roles_status"`
}

// SystemRequirementsNodeRoleStatus represents the status of a role on a system node.
type SystemRequirementsNodeRoleStatus struct {
	Status *string `json:"status,omitempty"`
	Role   *string `json:"role,omitempty"`
}

// NodeReleaseVersion represents a response from the GetNodeReleaseVersions method.
type NodeReleaseVersion struct {
	Hostname *string         `json:"hostname,omitempty"`
	Version  *ReleaseVersion `json:"version"`
}

// ReleaseVersion holds the release version information of the node.
type ReleaseVersion struct {
	Version   *string `json:"version,omitempty"`
	Platform  *string `json:"platform,omitempty"`
	BuildID   *string `json:"build_id,omitempty"`
	BuildDate *string `json:"build_date,omitempty"`
}

// CheckSystemRequirements checks if GHES system nodes meet the system requirements.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-the-system-requirement-check-results-for-configured-cluster-nodes
//
//meta:operation GET /manage/v1/checks/system-requirements
func (s *EnterpriseService) CheckSystemRequirements(ctx context.Context) (*SystemRequirements, *Response, error) {
	u := "manage/v1/checks/system-requirements"
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	systemRequirements := new(SystemRequirements)
	resp, err := s.client.Do(ctx, req, systemRequirements)
	if err != nil {
		return nil, resp, err
	}

	return systemRequirements, resp, nil
}

// ClusterStatus gets the status of all services running on each cluster node.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-the-status-of-services-running-on-all-cluster-nodes
//
//meta:operation GET /manage/v1/cluster/status
func (s *EnterpriseService) ClusterStatus(ctx context.Context) (*ClusterStatus, *Response, error) {
	u := "manage/v1/cluster/status"
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	clusterStatus := new(ClusterStatus)
	resp, err := s.client.Do(ctx, req, clusterStatus)
	if err != nil {
		return nil, resp, err
	}

	return clusterStatus, resp, nil
}

// ReplicationStatus gets the status of all services running on each replica node.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-the-status-of-services-running-on-all-replica-nodes
//
//meta:operation GET /manage/v1/replication/status
func (s *EnterpriseService) ReplicationStatus(ctx context.Context, opts *NodeQueryOptions) (*ClusterStatus, *Response, error) {
	u, err := addOptions("manage/v1/replication/status", opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	status := new(ClusterStatus)
	resp, err := s.client.Do(ctx, req, status)
	if err != nil {
		return nil, resp, err
	}

	return status, resp, nil
}

// GetNodeReleaseVersions gets the version information deployed to each node.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/manage-ghes#get-all-ghes-release-versions-for-all-nodes
//
//meta:operation GET /manage/v1/version
func (s *EnterpriseService) GetNodeReleaseVersions(ctx context.Context, opts *NodeQueryOptions) ([]*NodeReleaseVersion, *Response, error) {
	u, err := addOptions("manage/v1/version", opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var releaseVersions []*NodeReleaseVersion
	resp, err := s.client.Do(ctx, req, &releaseVersions)
	if err != nil {
		return nil, resp, err
	}

	return releaseVersions, resp, nil
}
