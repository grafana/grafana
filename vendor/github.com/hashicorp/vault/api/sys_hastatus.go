// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"net/http"
	"time"
)

func (c *Sys) HAStatus() (*HAStatusResponse, error) {
	return c.HAStatusWithContext(context.Background())
}

func (c *Sys) HAStatusWithContext(ctx context.Context) (*HAStatusResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/ha-status")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result HAStatusResponse
	err = resp.DecodeJSON(&result)
	return &result, err
}

type HAStatusResponse struct {
	Nodes []HANode
}

type HANode struct {
	Hostname                          string     `json:"hostname"`
	APIAddress                        string     `json:"api_address"`
	ClusterAddress                    string     `json:"cluster_address"`
	ActiveNode                        bool       `json:"active_node"`
	LastEcho                          *time.Time `json:"last_echo"`
	EchoDurationMillis                int64      `json:"echo_duration_ms"`
	ClockSkewMillis                   int64      `json:"clock_skew_ms"`
	Version                           string     `json:"version"`
	UpgradeVersion                    string     `json:"upgrade_version,omitempty"`
	RedundancyZone                    string     `json:"redundancy_zone,omitempty"`
	ReplicationPrimaryCanaryAgeMillis int64      `json:"replication_primary_canary_age_ms"`
}
