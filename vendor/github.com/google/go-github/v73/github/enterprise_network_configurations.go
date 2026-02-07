// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ListEnterpriseNetworkConfigurations lists all hosted compute network configurations configured in an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/network-configurations#list-hosted-compute-network-configurations-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/network-configurations
func (s *EnterpriseService) ListEnterpriseNetworkConfigurations(ctx context.Context, enterprise string, opts *ListOptions) (*NetworkConfigurations, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/network-configurations", enterprise)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	networks := &NetworkConfigurations{}
	resp, err := s.client.Do(ctx, req, networks)
	if err != nil {
		return nil, resp, err
	}
	return networks, resp, nil
}

// CreateEnterpriseNetworkConfiguration creates a hosted compute network configuration for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/network-configurations#create-a-hosted-compute-network-configuration-for-an-enterprise
//
//meta:operation POST /enterprises/{enterprise}/network-configurations
func (s *EnterpriseService) CreateEnterpriseNetworkConfiguration(ctx context.Context, enterprise string, createReq NetworkConfigurationRequest) (*NetworkConfiguration, *Response, error) {
	if err := validateNetworkConfigurationRequest(createReq); err != nil {
		return nil, nil, fmt.Errorf("validation failed: %w", err)
	}

	u := fmt.Sprintf("enterprises/%v/network-configurations", enterprise)
	req, err := s.client.NewRequest("POST", u, createReq)
	if err != nil {
		return nil, nil, err
	}

	network := &NetworkConfiguration{}
	resp, err := s.client.Do(ctx, req, network)
	if err != nil {
		return nil, resp, err
	}

	return network, resp, nil
}

// GetEnterpriseNetworkConfiguration gets a hosted compute network configuration configured in an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/network-configurations#get-a-hosted-compute-network-configuration-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/network-configurations/{network_configuration_id}
func (s *EnterpriseService) GetEnterpriseNetworkConfiguration(ctx context.Context, enterprise, networkID string) (*NetworkConfiguration, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/network-configurations/%v", enterprise, networkID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	network := &NetworkConfiguration{}
	resp, err := s.client.Do(ctx, req, network)
	if err != nil {
		return nil, resp, err
	}
	return network, resp, nil
}

// UpdateEnterpriseNetworkConfiguration updates a hosted compute network configuration for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/network-configurations#update-a-hosted-compute-network-configuration-for-an-enterprise
//
//meta:operation PATCH /enterprises/{enterprise}/network-configurations/{network_configuration_id}
func (s *EnterpriseService) UpdateEnterpriseNetworkConfiguration(ctx context.Context, enterprise, networkID string, updateReq NetworkConfigurationRequest) (*NetworkConfiguration, *Response, error) {
	if err := validateNetworkConfigurationRequest(updateReq); err != nil {
		return nil, nil, fmt.Errorf("validation failed: %w", err)
	}

	u := fmt.Sprintf("enterprises/%v/network-configurations/%v", enterprise, networkID)
	req, err := s.client.NewRequest("PATCH", u, updateReq)
	if err != nil {
		return nil, nil, err
	}

	network := &NetworkConfiguration{}
	resp, err := s.client.Do(ctx, req, network)
	if err != nil {
		return nil, resp, err
	}
	return network, resp, nil
}

// DeleteEnterpriseNetworkConfiguration deletes a hosted compute network configuration from an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/network-configurations#delete-a-hosted-compute-network-configuration-from-an-enterprise
//
//meta:operation DELETE /enterprises/{enterprise}/network-configurations/{network_configuration_id}
func (s *EnterpriseService) DeleteEnterpriseNetworkConfiguration(ctx context.Context, enterprise, networkID string) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/network-configurations/%v", enterprise, networkID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}

// GetEnterpriseNetworkSettingsResource gets a hosted compute network settings resource configured for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/network-configurations#get-a-hosted-compute-network-settings-resource-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/network-settings/{network_settings_id}
func (s *EnterpriseService) GetEnterpriseNetworkSettingsResource(ctx context.Context, enterprise, networkID string) (*NetworkSettingsResource, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/network-settings/%v", enterprise, networkID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	resource := &NetworkSettingsResource{}
	resp, err := s.client.Do(ctx, req, resource)
	if err != nil {
		return nil, resp, err
	}
	return resource, resp, err
}
