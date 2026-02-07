// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"net/http"
)

func (c *Sys) Health() (*HealthResponse, error) {
	return c.HealthWithContext(context.Background())
}

func (c *Sys) HealthWithContext(ctx context.Context) (*HealthResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/health")
	// If the code is 400 or above it will automatically turn into an error,
	// but the sys/health API defaults to returning 5xx when not sealed or
	// inited, so we force this code to be something else so we parse correctly
	r.Params.Add("uninitcode", "299")
	r.Params.Add("sealedcode", "299")
	r.Params.Add("standbycode", "299")
	r.Params.Add("drsecondarycode", "299")
	r.Params.Add("performancestandbycode", "299")
	r.Params.Add("removedcode", "299")
	r.Params.Add("haunhealthycode", "299")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result HealthResponse
	err = resp.DecodeJSON(&result)
	return &result, err
}

type HealthResponse struct {
	Initialized                          bool   `json:"initialized"`
	Sealed                               bool   `json:"sealed"`
	Standby                              bool   `json:"standby"`
	PerformanceStandby                   bool   `json:"performance_standby"`
	ReplicationPerformanceMode           string `json:"replication_performance_mode"`
	ReplicationDRMode                    string `json:"replication_dr_mode"`
	ServerTimeUTC                        int64  `json:"server_time_utc"`
	Version                              string `json:"version"`
	ClusterName                          string `json:"cluster_name,omitempty"`
	ClusterID                            string `json:"cluster_id,omitempty"`
	LastWAL                              uint64 `json:"last_wal,omitempty"`
	Enterprise                           bool   `json:"enterprise"`
	EchoDurationMillis                   int64  `json:"echo_duration_ms"`
	ClockSkewMillis                      int64  `json:"clock_skew_ms"`
	ReplicationPrimaryCanaryAgeMillis    int64  `json:"replication_primary_canary_age_ms"`
	RemovedFromCluster                   *bool  `json:"removed_from_cluster,omitempty"`
	HAConnectionHealthy                  *bool  `json:"ha_connection_healthy,omitempty"`
	LastRequestForwardingHeartbeatMillis int64  `json:"last_request_forwarding_heartbeat_ms,omitempty"`
}
