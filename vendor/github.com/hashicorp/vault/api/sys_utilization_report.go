// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/mitchellh/mapstructure"
)

func (c *Sys) UtilizationReport() (*UtilizationReportOutput, error) {
	return c.UtilizationReportWithContext(context.Background())
}

func (c *Sys) UtilizationReportWithContext(ctx context.Context) (*UtilizationReportOutput, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/utilization-report")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result UtilizationReportOutput
	err = mapstructure.Decode(secret.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, err
}

type UtilizationReportOutput struct {
	Namespaces int `json:"namespaces,omitempty" structs:"namespaces" mapstructure:"namespaces"`

	KVV1Secrets int `json:"kvv1_secrets,omitempty" structs:"kvv1_secrets" mapstructure:"kvv1_secrets"`
	KVV2Secrets int `json:"kvv2_secrets,omitempty" structs:"kvv2_secrets" mapstructure:"kvv2_secrets"`

	AuthMethods   map[string]int `json:"auth_methods,omitempty" structs:"auth_methods" mapstructure:"auth_methods"`
	SecretEngines map[string]int `json:"secret_engines,omitempty" structs:"secret_engines" mapstructure:"secret_engines"`

	LeasesByAuthMethod map[string]int `json:"leases_by_auth_method,omitempty" structs:"leases_by_auth_method" mapstructure:"leases_by_auth_method"`

	ReplicationStatus *UtilizationReportReplicationStatusInformation `json:"replication_status,omitempty" structs:"replication_status" mapstructure:"replication_status"`

	PKI *UtilizationReportPKIInformation `json:"pki,omitempty" structs:"pki" mapstructure:"pki"`

	SecretSync *UtilizationReportSecretSyncInformation `json:"secret_sync,omitempty" structs:"secret_sync" mapstructure:"secret_sync"`

	LeaseCountQuotas *UtilizationReportLeaseCountQuotaInformation `json:"lease_count_quotas,omitempty" structs:"lease_count_quotas" mapstructure:"lease_count_quotas"`
}

type UtilizationReportReplicationStatusInformation struct {
	DRPrimary bool   `json:"dr_primary,omitempty" structs:"dr_primary" mapstructure:"dr_primary"`
	DRState   string `json:"dr_state,omitempty" structs:"dr_state" mapstructure:"dr_state"`
	PRPrimary bool   `json:"pr_primary,omitempty" structs:"pr_primary" mapstructure:"pr_primary"`
	PRState   string `json:"pr_state,omitempty" structs:"pr_state" mapstructure:"pr_state"`
}

type UtilizationReportPKIInformation struct {
	TotalRoles   int `json:"total_roles,omitempty" structs:"total_roles" mapstructure:"total_roles"`
	TotalIssuers int `json:"total_issuers,omitempty" structs:"total_issuers" mapstructure:"total_issuers"`
}

type UtilizationReportSecretSyncInformation struct {
	TotalSources      int `json:"total_sources,omitempty" structs:"total_sources" mapstructure:"total_sources"`
	TotalDestinations int `json:"total_destinations,omitempty" structs:"total_destinations" mapstructure:"total_destinations"`
}

type UtilizationReportLeaseCountQuotaInformation struct {
	TotalLeaseCountQuotas            int                                                `json:"total_lease_count_quotas,omitempty" structs:"total_lease_count_quotas" mapstructure:"total_lease_count_quotas"`
	GlobalLeaseCountQuotaInformation *UtilizationReportGlobalLeaseCountQuotaInformation `json:"global_lease_count_quota,omitempty" structs:"global_lease_count_quota" mapstructure:"global_lease_count_quota"`
}

type UtilizationReportGlobalLeaseCountQuotaInformation struct {
	Name     string `json:"name,omitempty" structs:"name" mapstructure:"name"`
	Capacity int    `json:"capacity,omitempty" structs:"capacity" mapstructure:"capacity"`
	Count    int    `json:"count,omitempty" structs:"count" mapstructure:"count"`
}
