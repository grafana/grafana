// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mitchellh/mapstructure"
)

const (
	apiRepPerformanceStatusPath = "/v1/sys/replication/performance/status"
	apiRepDRStatusPath          = "/v1/sys/replication/dr/status"
	apiRepStatusPath            = "/v1/sys/replication/status"
)

type ClusterInfo struct {
	APIAddr                           string `json:"api_address,omitempty" mapstructure:"api_address"`
	ClusterAddress                    string `json:"cluster_address,omitempty" mapstructure:"cluster_address"`
	ConnectionStatus                  string `json:"connection_status,omitempty" mapstructure:"connection_status"`
	LastHeartBeat                     string `json:"last_heartbeat,omitempty" mapstructure:"last_heartbeat"`
	LastHeartBeatDurationMillis       string `json:"last_heartbeat_duration_ms,omitempty" mapstructure:"last_heartbeat_duration_ms"`
	ClockSkewMillis                   string `json:"clock_skew_ms,omitempty" mapstructure:"clock_skew_ms"`
	NodeID                            string `json:"node_id,omitempty" mapstructure:"node_id"`
	ReplicationPrimaryCanaryAgeMillis string `json:"replication_primary_canary_age_ms,omitempty" mapstructure:"replication_primary_canary_age_ms"`
}

type ReplicationStatusGenericResponse struct {
	LastDRWAL             uint64 `json:"last_dr_wal,omitempty" mapstructure:"last_dr_wal"`
	LastReindexEpoch      string `json:"last_reindex_epoch,omitempty" mapstructure:"last_reindex_epoch"`
	ClusterID             string `json:"cluster_id,omitempty" mapstructure:"cluster_id"`
	LastWAL               uint64 `json:"last_wal,omitempty" mapstructure:"last_wal"`
	MerkleRoot            string `json:"merkle_root,omitempty" mapstructure:"merkle_root"`
	Mode                  string `json:"mode,omitempty" mapstructure:"mode"`
	PrimaryClusterAddr    string `json:"primary_cluster_addr,omitempty" mapstructure:"primary_cluster_addr"`
	LastPerformanceWAL    uint64 `json:"last_performance_wal,omitempty" mapstructure:"last_performance_wal"`
	State                 string `json:"state,omitempty" mapstructure:"state"`
	LastRemoteWAL         uint64 `json:"last_remote_wal,omitempty" mapstructure:"last_remote_wal"`
	SecondaryID           string `json:"secondary_id,omitempty" mapstructure:"secondary_id"`
	SSCTGenerationCounter uint64 `json:"ssct_generation_counter,omitempty" mapstructure:"ssct_generation_counter"`

	KnownSecondaries         []string      `json:"known_secondaries,omitempty" mapstructure:"known_secondaries"`
	KnownPrimaryClusterAddrs []string      `json:"known_primary_cluster_addrs,omitempty" mapstructure:"known_primary_cluster_addrs"`
	Primaries                []ClusterInfo `json:"primaries,omitempty" mapstructure:"primaries"`
	Secondaries              []ClusterInfo `json:"secondaries,omitempty" mapstructure:"secondaries"`
}

type ReplicationStatusResponse struct {
	DR          ReplicationStatusGenericResponse `json:"dr,omitempty" mapstructure:"dr"`
	Performance ReplicationStatusGenericResponse `json:"performance,omitempty" mapstructure:"performance"`
}

func (c *Sys) ReplicationStatus() (*ReplicationStatusResponse, error) {
	return c.ReplicationStatusWithContext(context.Background(), apiRepStatusPath)
}

func (c *Sys) ReplicationPerformanceStatusWithContext(ctx context.Context) (*ReplicationStatusGenericResponse, error) {
	s, err := c.ReplicationStatusWithContext(ctx, apiRepPerformanceStatusPath)
	if err != nil {
		return nil, err
	}

	return &s.Performance, nil
}

func (c *Sys) ReplicationDRStatusWithContext(ctx context.Context) (*ReplicationStatusGenericResponse, error) {
	s, err := c.ReplicationStatusWithContext(ctx, apiRepDRStatusPath)
	if err != nil {
		return nil, err
	}

	return &s.DR, nil
}

func (c *Sys) ReplicationStatusWithContext(ctx context.Context, path string) (*ReplicationStatusResponse, error) {
	// default to replication/status
	if path == "" {
		path = apiRepStatusPath
	}

	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, path)

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	// First decode response into a map[string]interface{}
	data := make(map[string]interface{})
	dec := json.NewDecoder(resp.Body)
	dec.UseNumber()
	if err := dec.Decode(&data); err != nil {
		return nil, err
	}

	rawData, ok := data["data"]
	if !ok {
		return nil, fmt.Errorf("empty data in replication status response")
	}

	s := &ReplicationStatusResponse{}
	g := &ReplicationStatusGenericResponse{}
	switch {
	case path == apiRepPerformanceStatusPath:
		err = mapstructure.Decode(rawData, g)
		if err != nil {
			return nil, err
		}
		s.Performance = *g
	case path == apiRepDRStatusPath:
		err = mapstructure.Decode(rawData, g)
		if err != nil {
			return nil, err
		}
		s.DR = *g
	default:
		err = mapstructure.Decode(rawData, s)
		if err != nil {
			return nil, err
		}
		return s, err
	}

	return s, err
}
