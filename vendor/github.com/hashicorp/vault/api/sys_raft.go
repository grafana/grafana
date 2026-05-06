// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"sync"
	"time"

	"github.com/hashicorp/go-secure-stdlib/parseutil"
	"github.com/mitchellh/mapstructure"
)

var ErrIncompleteSnapshot = errors.New("incomplete snapshot, unable to read SHA256SUMS.sealed file")

// RaftJoinResponse represents the response of the raft join API
type RaftJoinResponse struct {
	Joined bool `json:"joined"`
}

// RaftJoinRequest represents the parameters consumed by the raft join API
type RaftJoinRequest struct {
	AutoJoin         string `json:"auto_join"`
	AutoJoinScheme   string `json:"auto_join_scheme"`
	AutoJoinPort     uint   `json:"auto_join_port"`
	LeaderAPIAddr    string `json:"leader_api_addr"`
	LeaderCACert     string `json:"leader_ca_cert"`
	LeaderClientCert string `json:"leader_client_cert"`
	LeaderClientKey  string `json:"leader_client_key"`
	Retry            bool   `json:"retry"`
	NonVoter         bool   `json:"non_voter"`
}

// AutopilotConfig is used for querying/setting the Autopilot configuration.
type AutopilotConfig struct {
	CleanupDeadServers             bool          `json:"cleanup_dead_servers" mapstructure:"cleanup_dead_servers"`
	LastContactThreshold           time.Duration `json:"last_contact_threshold" mapstructure:"-"`
	DeadServerLastContactThreshold time.Duration `json:"dead_server_last_contact_threshold" mapstructure:"-"`
	MaxTrailingLogs                uint64        `json:"max_trailing_logs" mapstructure:"max_trailing_logs"`
	MinQuorum                      uint          `json:"min_quorum" mapstructure:"min_quorum"`
	ServerStabilizationTime        time.Duration `json:"server_stabilization_time" mapstructure:"-"`
	DisableUpgradeMigration        bool          `json:"disable_upgrade_migration" mapstructure:"disable_upgrade_migration"`
}

// MarshalJSON makes the autopilot config fields JSON compatible
func (ac *AutopilotConfig) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"cleanup_dead_servers":               ac.CleanupDeadServers,
		"last_contact_threshold":             ac.LastContactThreshold.String(),
		"dead_server_last_contact_threshold": ac.DeadServerLastContactThreshold.String(),
		"max_trailing_logs":                  ac.MaxTrailingLogs,
		"min_quorum":                         ac.MinQuorum,
		"server_stabilization_time":          ac.ServerStabilizationTime.String(),
		"disable_upgrade_migration":          ac.DisableUpgradeMigration,
	})
}

// UnmarshalJSON parses the autopilot config JSON blob
func (ac *AutopilotConfig) UnmarshalJSON(b []byte) error {
	var data interface{}
	err := json.Unmarshal(b, &data)
	if err != nil {
		return err
	}

	conf := data.(map[string]interface{})
	if err = mapstructure.WeakDecode(conf, ac); err != nil {
		return err
	}
	if ac.LastContactThreshold, err = parseutil.ParseDurationSecond(conf["last_contact_threshold"]); err != nil {
		return err
	}
	if ac.DeadServerLastContactThreshold, err = parseutil.ParseDurationSecond(conf["dead_server_last_contact_threshold"]); err != nil {
		return err
	}
	if ac.ServerStabilizationTime, err = parseutil.ParseDurationSecond(conf["server_stabilization_time"]); err != nil {
		return err
	}
	return nil
}

// AutopilotState represents the response of the raft autopilot state API
type AutopilotState struct {
	Healthy                    bool                        `mapstructure:"healthy"`
	FailureTolerance           int                         `mapstructure:"failure_tolerance"`
	Servers                    map[string]*AutopilotServer `mapstructure:"servers"`
	Leader                     string                      `mapstructure:"leader"`
	Voters                     []string                    `mapstructure:"voters"`
	NonVoters                  []string                    `mapstructure:"non_voters"`
	RedundancyZones            map[string]AutopilotZone    `mapstructure:"redundancy_zones,omitempty"`
	Upgrade                    *AutopilotUpgrade           `mapstructure:"upgrade_info,omitempty"`
	OptimisticFailureTolerance int                         `mapstructure:"optimistic_failure_tolerance,omitempty"`
}

func (a *AutopilotState) String() string {
	var result string
	result += fmt.Sprintf("Healthy: %t. FailureTolerance: %d. Leader: %s. OptimisticFailureTolerance: %d\n", a.Healthy, a.FailureTolerance, a.Leader, a.OptimisticFailureTolerance)
	for _, s := range a.Servers {
		result += fmt.Sprintf("Server: %s\n", s)
	}
	result += fmt.Sprintf("Voters: %v\n", a.Voters)
	result += fmt.Sprintf("NonVoters: %v\n", a.NonVoters)

	for name, zone := range a.RedundancyZones {
		result += fmt.Sprintf("RedundancyZone %s: %s\n", name, &zone)
	}

	result += fmt.Sprintf("Upgrade: %s", a.Upgrade)
	return result
}

// AutopilotServer represents the server blocks in the response of the raft
// autopilot state API.
type AutopilotServer struct {
	ID             string `mapstructure:"id"`
	Name           string `mapstructure:"name"`
	Address        string `mapstructure:"address"`
	NodeStatus     string `mapstructure:"node_status"`
	LastContact    string `mapstructure:"last_contact"`
	LastTerm       uint64 `mapstructure:"last_term"`
	LastIndex      uint64 `mapstructure:"last_index"`
	Healthy        bool   `mapstructure:"healthy"`
	StableSince    string `mapstructure:"stable_since"`
	Status         string `mapstructure:"status"`
	Version        string `mapstructure:"version"`
	UpgradeVersion string `mapstructure:"upgrade_version,omitempty"`
	RedundancyZone string `mapstructure:"redundancy_zone,omitempty"`
	NodeType       string `mapstructure:"node_type,omitempty"`
}

func (a *AutopilotServer) String() string {
	return fmt.Sprintf("ID: %s. Name: %s. Address: %s. NodeStatus: %s. LastContact: %s. LastTerm: %d. LastIndex: %d. Healthy: %t. StableSince: %s. Status: %s. Version: %s. UpgradeVersion: %s. RedundancyZone: %s. NodeType: %s",
		a.ID, a.Name, a.Address, a.NodeStatus, a.LastContact, a.LastTerm, a.LastIndex, a.Healthy, a.StableSince, a.Status, a.Version, a.UpgradeVersion, a.RedundancyZone, a.NodeType)
}

type AutopilotZone struct {
	Servers          []string `mapstructure:"servers,omitempty"`
	Voters           []string `mapstructure:"voters,omitempty"`
	FailureTolerance int      `mapstructure:"failure_tolerance,omitempty"`
}

func (a *AutopilotZone) String() string {
	return fmt.Sprintf("Servers: %v. Voters: %v. FailureTolerance: %d", a.Servers, a.Voters, a.FailureTolerance)
}

type AutopilotUpgrade struct {
	Status                    string                                  `mapstructure:"status"`
	TargetVersion             string                                  `mapstructure:"target_version,omitempty"`
	TargetVersionVoters       []string                                `mapstructure:"target_version_voters,omitempty"`
	TargetVersionNonVoters    []string                                `mapstructure:"target_version_non_voters,omitempty"`
	TargetVersionReadReplicas []string                                `mapstructure:"target_version_read_replicas,omitempty"`
	OtherVersionVoters        []string                                `mapstructure:"other_version_voters,omitempty"`
	OtherVersionNonVoters     []string                                `mapstructure:"other_version_non_voters,omitempty"`
	OtherVersionReadReplicas  []string                                `mapstructure:"other_version_read_replicas,omitempty"`
	RedundancyZones           map[string]AutopilotZoneUpgradeVersions `mapstructure:"redundancy_zones,omitempty"`
}

func (a *AutopilotUpgrade) String() string {
	result := fmt.Sprintf("Status: %s. TargetVersion: %s. TargetVersionVoters: %v. TargetVersionNonVoters: %v. TargetVersionReadReplicas: %v. OtherVersionVoters: %v. OtherVersionNonVoters: %v. OtherVersionReadReplicas: %v",
		a.Status, a.TargetVersion, a.TargetVersionVoters, a.TargetVersionNonVoters, a.TargetVersionReadReplicas, a.OtherVersionVoters, a.OtherVersionNonVoters, a.OtherVersionReadReplicas)

	for name, zone := range a.RedundancyZones {
		result += fmt.Sprintf("Redundancy Zone %s: %s", name, zone)
	}

	return result
}

type AutopilotZoneUpgradeVersions struct {
	TargetVersionVoters    []string `mapstructure:"target_version_voters,omitempty"`
	TargetVersionNonVoters []string `mapstructure:"target_version_non_voters,omitempty"`
	OtherVersionVoters     []string `mapstructure:"other_version_voters,omitempty"`
	OtherVersionNonVoters  []string `mapstructure:"other_version_non_voters,omitempty"`
}

func (a *AutopilotZoneUpgradeVersions) String() string {
	return fmt.Sprintf("TargetVersionVoters: %v. TargetVersionNonVoters: %v. OtherVersionVoters: %v. OtherVersionNonVoters: %v",
		a.TargetVersionVoters, a.TargetVersionNonVoters, a.OtherVersionVoters, a.OtherVersionNonVoters)
}

// RaftJoin wraps RaftJoinWithContext using context.Background.
func (c *Sys) RaftJoin(opts *RaftJoinRequest) (*RaftJoinResponse, error) {
	return c.RaftJoinWithContext(context.Background(), opts)
}

// RaftJoinWithContext adds the node from which this call is invoked from to the raft
// cluster represented by the leader address in the parameter.
func (c *Sys) RaftJoinWithContext(ctx context.Context, opts *RaftJoinRequest) (*RaftJoinResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPost, "/v1/sys/storage/raft/join")

	if err := r.SetJSONBody(opts); err != nil {
		return nil, err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result RaftJoinResponse
	err = resp.DecodeJSON(&result)
	return &result, err
}

// RaftSnapshot wraps RaftSnapshotWithContext using context.Background.
func (c *Sys) RaftSnapshot(snapWriter io.Writer) error {
	return c.RaftSnapshotWithContext(context.Background(), snapWriter)
}

// RaftSnapshotWithContext invokes the API that takes the snapshot of the raft cluster and
// writes it to the supplied io.Writer.
func (c *Sys) RaftSnapshotWithContext(ctx context.Context, snapWriter io.Writer) error {
	r := c.c.NewRequest(http.MethodGet, "/v1/sys/storage/raft/snapshot")
	r.URL.RawQuery = r.Params.Encode()

	resp, err := c.c.httpRequestWithContext(ctx, r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Make sure that the last file in the archive, SHA256SUMS.sealed, is present
	// and non-empty.  This is to catch cases where the snapshot failed midstream,
	// e.g. due to a problem with the seal that prevented encryption of that file.
	var wg sync.WaitGroup
	wg.Add(1)
	var verified bool

	rPipe, wPipe := io.Pipe()
	dup := io.TeeReader(resp.Body, wPipe)
	go func() {
		defer func() {
			io.Copy(ioutil.Discard, rPipe)
			rPipe.Close()
			wg.Done()
		}()

		uncompressed, err := gzip.NewReader(rPipe)
		if err != nil {
			return
		}

		t := tar.NewReader(uncompressed)
		var h *tar.Header
		for {
			h, err = t.Next()
			if err != nil {
				return
			}
			if h.Name != "SHA256SUMS.sealed" {
				continue
			}
			var b []byte
			b, err = io.ReadAll(t)
			if err != nil || len(b) == 0 {
				return
			}
			verified = true
			return
		}
	}()

	// Copy bytes from dup to snapWriter.  This will have a side effect that
	// everything read from dup will be written to wPipe.
	_, err = io.Copy(snapWriter, dup)
	wPipe.Close()
	if err != nil {
		rPipe.CloseWithError(err)
		return err
	}
	wg.Wait()

	if !verified {
		return ErrIncompleteSnapshot
	}
	return nil
}

// RaftSnapshotRestore wraps RaftSnapshotRestoreWithContext using context.Background.
func (c *Sys) RaftSnapshotRestore(snapReader io.Reader, force bool) error {
	return c.RaftSnapshotRestoreWithContext(context.Background(), snapReader, force)
}

// RaftSnapshotRestoreWithContext reads the snapshot from the io.Reader and installs that
// snapshot, returning the cluster to the state defined by it.
func (c *Sys) RaftSnapshotRestoreWithContext(ctx context.Context, snapReader io.Reader, force bool) error {
	path := "/v1/sys/storage/raft/snapshot"
	if force {
		path = "/v1/sys/storage/raft/snapshot-force"
	}

	r := c.c.NewRequest(http.MethodPost, path)
	r.Body = snapReader

	resp, err := c.c.httpRequestWithContext(ctx, r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// RaftAutopilotState wraps RaftAutopilotStateWithContext using context.Background.
func (c *Sys) RaftAutopilotState() (*AutopilotState, error) {
	return c.RaftAutopilotStateWithContext(context.Background())
}

// RaftAutopilotStateWithToken wraps RaftAutopilotStateWithContext using the given token.
func (c *Sys) RaftAutopilotStateWithDRToken(drToken string) (*AutopilotState, error) {
	return c.RaftAutopilotStateWithContext(context.WithValue(context.Background(), "dr-token", drToken))
}

// RaftAutopilotStateWithContext returns the state of the raft cluster as seen by autopilot.
func (c *Sys) RaftAutopilotStateWithContext(ctx context.Context) (*AutopilotState, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	if ctx.Value("dr-token") != nil {
		c.c.SetToken(ctx.Value("dr-token").(string))
	}
	r := c.c.NewRequest(http.MethodGet, "/v1/sys/storage/raft/autopilot/state")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if resp != nil {
		defer resp.Body.Close()
		if resp.StatusCode == 404 {
			return nil, nil
		}
	}
	if err != nil {
		return nil, err
	}

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result AutopilotState
	err = mapstructure.Decode(secret.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, err
}

// RaftAutopilotConfiguration wraps RaftAutopilotConfigurationWithContext using context.Background.
func (c *Sys) RaftAutopilotConfiguration() (*AutopilotConfig, error) {
	return c.RaftAutopilotConfigurationWithContext(context.Background())
}

// RaftAutopilotConfigurationWithDRToken wraps RaftAutopilotConfigurationWithContext using the given token.
func (c *Sys) RaftAutopilotConfigurationWithDRToken(drToken string) (*AutopilotConfig, error) {
	return c.RaftAutopilotConfigurationWithContext(context.WithValue(context.Background(), "dr-token", drToken))
}

// RaftAutopilotConfigurationWithContext fetches the autopilot config.
func (c *Sys) RaftAutopilotConfigurationWithContext(ctx context.Context) (*AutopilotConfig, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	if ctx.Value("dr-token") != nil {
		c.c.SetToken(ctx.Value("dr-token").(string))
	}

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/storage/raft/autopilot/configuration")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if resp != nil {
		defer resp.Body.Close()
		if resp.StatusCode == 404 {
			return nil, nil
		}
	}
	if err != nil {
		return nil, err
	}

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result AutopilotConfig
	if err = mapstructure.Decode(secret.Data, &result); err != nil {
		return nil, err
	}
	if result.LastContactThreshold, err = parseutil.ParseDurationSecond(secret.Data["last_contact_threshold"]); err != nil {
		return nil, err
	}
	if result.DeadServerLastContactThreshold, err = parseutil.ParseDurationSecond(secret.Data["dead_server_last_contact_threshold"]); err != nil {
		return nil, err
	}
	if result.ServerStabilizationTime, err = parseutil.ParseDurationSecond(secret.Data["server_stabilization_time"]); err != nil {
		return nil, err
	}

	return &result, err
}

// PutRaftAutopilotConfiguration wraps PutRaftAutopilotConfigurationWithContext using context.Background.
func (c *Sys) PutRaftAutopilotConfiguration(opts *AutopilotConfig) error {
	return c.PutRaftAutopilotConfigurationWithContext(context.Background(), opts)
}

// PutRaftAutopilotConfigurationWithContext allows modifying the raft autopilot configuration
func (c *Sys) PutRaftAutopilotConfigurationWithContext(ctx context.Context, opts *AutopilotConfig) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPost, "/v1/sys/storage/raft/autopilot/configuration")

	if err := r.SetJSONBody(opts); err != nil {
		return err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}
