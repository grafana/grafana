// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// ClusterStateService allows to get a comprehensive state information of the whole cluster.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/cluster-state.html
// for details.
type ClusterStateService struct {
	client            *Client
	pretty            bool
	indices           []string
	metrics           []string
	allowNoIndices    *bool
	expandWildcards   string
	flatSettings      *bool
	ignoreUnavailable *bool
	local             *bool
	masterTimeout     string
}

// NewClusterStateService creates a new ClusterStateService.
func NewClusterStateService(client *Client) *ClusterStateService {
	return &ClusterStateService{
		client:  client,
		indices: make([]string, 0),
		metrics: make([]string, 0),
	}
}

// Index is a list of index names. Use _all or an empty string to
// perform the operation on all indices.
func (s *ClusterStateService) Index(indices ...string) *ClusterStateService {
	s.indices = append(s.indices, indices...)
	return s
}

// Metric limits the information returned to the specified metric.
// It can be one of: version, master_node, nodes, routing_table, metadata,
// blocks, or customs.
func (s *ClusterStateService) Metric(metrics ...string) *ClusterStateService {
	s.metrics = append(s.metrics, metrics...)
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *ClusterStateService) AllowNoIndices(allowNoIndices bool) *ClusterStateService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both..
func (s *ClusterStateService) ExpandWildcards(expandWildcards string) *ClusterStateService {
	s.expandWildcards = expandWildcards
	return s
}

// FlatSettings, when set, returns settings in flat format (default: false).
func (s *ClusterStateService) FlatSettings(flatSettings bool) *ClusterStateService {
	s.flatSettings = &flatSettings
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *ClusterStateService) IgnoreUnavailable(ignoreUnavailable bool) *ClusterStateService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// Local indicates whether to return local information. When set, it does not
// retrieve the state from master node (default: false).
func (s *ClusterStateService) Local(local bool) *ClusterStateService {
	s.local = &local
	return s
}

// MasterTimeout specifies timeout for connection to master.
func (s *ClusterStateService) MasterTimeout(masterTimeout string) *ClusterStateService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *ClusterStateService) Pretty(pretty bool) *ClusterStateService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *ClusterStateService) buildURL() (string, url.Values, error) {
	// Build URL
	metrics := strings.Join(s.metrics, ",")
	if metrics == "" {
		metrics = "_all"
	}
	indices := strings.Join(s.indices, ",")
	if indices == "" {
		indices = "_all"
	}
	path, err := uritemplates.Expand("/_cluster/state/{metrics}/{indices}", map[string]string{
		"metrics": metrics,
		"indices": indices,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.flatSettings != nil {
		params.Set("flat_settings", fmt.Sprintf("%v", *s.flatSettings))
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *ClusterStateService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *ClusterStateService) Do(ctx context.Context) (*ClusterStateResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(ClusterStateResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// ClusterStateResponse is the response of ClusterStateService.Do.
type ClusterStateResponse struct {
	ClusterName  string                               `json:"cluster_name"`
	Version      int64                                `json:"version"`
	StateUUID    string                               `json:"state_uuid"`
	MasterNode   string                               `json:"master_node"`
	Blocks       map[string]*clusterBlocks            `json:"blocks"`
	Nodes        map[string]*discoveryNode            `json:"nodes"`
	Metadata     *clusterStateMetadata                `json:"metadata"`
	RoutingTable map[string]*clusterStateRoutingTable `json:"routing_table"`
	RoutingNodes *clusterStateRoutingNode             `json:"routing_nodes"`
	Customs      map[string]interface{}               `json:"customs"`
}

type clusterBlocks struct {
	Global  map[string]*clusterBlock `json:"global"`  // id -> cluster block
	Indices map[string]*clusterBlock `json:"indices"` // index name -> cluster block
}

type clusterBlock struct {
	Description             string   `json:"description"`
	Retryable               bool     `json:"retryable"`
	DisableStatePersistence bool     `json:"disable_state_persistence"`
	Levels                  []string `json:"levels"`
}

type clusterStateMetadata struct {
	ClusterUUID  string                            `json:"cluster_uuid"`
	Templates    map[string]*indexTemplateMetaData `json:"templates"` // template name -> index template metadata
	Indices      map[string]*indexMetaData         `json:"indices"`   // index name _> meta data
	RoutingTable struct {
		Indices map[string]*indexRoutingTable `json:"indices"` // index name -> routing table
	} `json:"routing_table"`
	RoutingNodes struct {
		Unassigned []*shardRouting `json:"unassigned"`
		Nodes      []*shardRouting `json:"nodes"`
	} `json:"routing_nodes"`
	Customs map[string]interface{} `json:"customs"`
}

type discoveryNode struct {
	Name             string                 `json:"name"`              // server name, e.g. "es1"
	TransportAddress string                 `json:"transport_address"` // e.g. inet[/1.2.3.4:9300]
	Attributes       map[string]interface{} `json:"attributes"`        // e.g. { "data": true, "master": true }
}

type clusterStateRoutingTable struct {
	Indices map[string]interface{} `json:"indices"`
}

type clusterStateRoutingNode struct {
	Unassigned []*shardRouting `json:"unassigned"`
	// Node Id -> shardRouting
	Nodes map[string][]*shardRouting `json:"nodes"`
}

type indexTemplateMetaData struct {
	Template string                 `json:"template"` // e.g. "store-*"
	Order    int                    `json:"order"`
	Settings map[string]interface{} `json:"settings"` // index settings
	Mappings map[string]interface{} `json:"mappings"` // type name -> mapping
}

type indexMetaData struct {
	State    string                 `json:"state"`
	Settings map[string]interface{} `json:"settings"`
	Mappings map[string]interface{} `json:"mappings"`
	Aliases  []string               `json:"aliases"` // e.g. [ "alias1", "alias2" ]
}

type indexRoutingTable struct {
	Shards map[string]*shardRouting `json:"shards"`
}

type shardRouting struct {
	State          string          `json:"state"`
	Primary        bool            `json:"primary"`
	Node           string          `json:"node"`
	RelocatingNode string          `json:"relocating_node"`
	Shard          int             `json:"shard"`
	Index          string          `json:"index"`
	Version        int64           `json:"version"`
	RestoreSource  *RestoreSource  `json:"restore_source"`
	AllocationId   *allocationId   `json:"allocation_id"`
	UnassignedInfo *unassignedInfo `json:"unassigned_info"`
}

type RestoreSource struct {
	Repository string `json:"repository"`
	Snapshot   string `json:"snapshot"`
	Version    string `json:"version"`
	Index      string `json:"index"`
}

type allocationId struct {
	Id           string `json:"id"`
	RelocationId string `json:"relocation_id"`
}

type unassignedInfo struct {
	Reason  string `json:"reason"`
	At      string `json:"at"`
	Details string `json:"details"`
}
