// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// NodesStatsService returns node statistics.
// See http://www.elastic.co/guide/en/elasticsearch/reference/master/cluster-nodes-stats.html
// for details.
type NodesStatsService struct {
	client           *Client
	pretty           bool
	metric           []string
	indexMetric      []string
	nodeId           []string
	completionFields []string
	fielddataFields  []string
	fields           []string
	groups           *bool
	human            *bool
	level            string
	timeout          string
	types            []string
}

// NewNodesStatsService creates a new NodesStatsService.
func NewNodesStatsService(client *Client) *NodesStatsService {
	return &NodesStatsService{
		client: client,
	}
}

// Metric limits the information returned to the specified metrics.
func (s *NodesStatsService) Metric(metric ...string) *NodesStatsService {
	s.metric = append(s.metric, metric...)
	return s
}

// IndexMetric limits the information returned for `indices` metric
// to the specific index metrics. Isn't used if `indices` (or `all`)
// metric isn't specified..
func (s *NodesStatsService) IndexMetric(indexMetric ...string) *NodesStatsService {
	s.indexMetric = append(s.indexMetric, indexMetric...)
	return s
}

// NodeId is a list of node IDs or names to limit the returned information;
// use `_local` to return information from the node you're connecting to,
// leave empty to get information from all nodes.
func (s *NodesStatsService) NodeId(nodeId ...string) *NodesStatsService {
	s.nodeId = append(s.nodeId, nodeId...)
	return s
}

// CompletionFields is a list of fields for `fielddata` and `suggest`
// index metric (supports wildcards).
func (s *NodesStatsService) CompletionFields(completionFields ...string) *NodesStatsService {
	s.completionFields = append(s.completionFields, completionFields...)
	return s
}

// FielddataFields is a list of fields for `fielddata` index metric (supports wildcards).
func (s *NodesStatsService) FielddataFields(fielddataFields ...string) *NodesStatsService {
	s.fielddataFields = append(s.fielddataFields, fielddataFields...)
	return s
}

// Fields is a list of fields for `fielddata` and `completion` index metric (supports wildcards).
func (s *NodesStatsService) Fields(fields ...string) *NodesStatsService {
	s.fields = append(s.fields, fields...)
	return s
}

// Groups is a list of search groups for `search` index metric.
func (s *NodesStatsService) Groups(groups bool) *NodesStatsService {
	s.groups = &groups
	return s
}

// Human indicates whether to return time and byte values in human-readable format.
func (s *NodesStatsService) Human(human bool) *NodesStatsService {
	s.human = &human
	return s
}

// Level specifies whether to return indices stats aggregated at node, index or shard level.
func (s *NodesStatsService) Level(level string) *NodesStatsService {
	s.level = level
	return s
}

// Timeout specifies an explicit operation timeout.
func (s *NodesStatsService) Timeout(timeout string) *NodesStatsService {
	s.timeout = timeout
	return s
}

// Types a list of document types for the `indexing` index metric.
func (s *NodesStatsService) Types(types ...string) *NodesStatsService {
	s.types = append(s.types, types...)
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *NodesStatsService) Pretty(pretty bool) *NodesStatsService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *NodesStatsService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.nodeId) > 0 && len(s.metric) > 0 && len(s.indexMetric) > 0 {
		path, err = uritemplates.Expand("/_nodes/{node_id}/stats/{metric}/{index_metric}", map[string]string{
			"index_metric": strings.Join(s.indexMetric, ","),
			"node_id":      strings.Join(s.nodeId, ","),
			"metric":       strings.Join(s.metric, ","),
		})
	} else if len(s.nodeId) > 0 && len(s.metric) > 0 && len(s.indexMetric) == 0 {
		path, err = uritemplates.Expand("/_nodes/{node_id}/stats/{metric}", map[string]string{
			"node_id": strings.Join(s.nodeId, ","),
			"metric":  strings.Join(s.metric, ","),
		})
	} else if len(s.nodeId) > 0 && len(s.metric) == 0 && len(s.indexMetric) > 0 {
		path, err = uritemplates.Expand("/_nodes/{node_id}/stats/_all/{index_metric}", map[string]string{
			"index_metric": strings.Join(s.indexMetric, ","),
			"node_id":      strings.Join(s.nodeId, ","),
		})
	} else if len(s.nodeId) > 0 && len(s.metric) == 0 && len(s.indexMetric) == 0 {
		path, err = uritemplates.Expand("/_nodes/{node_id}/stats", map[string]string{
			"node_id": strings.Join(s.nodeId, ","),
		})
	} else if len(s.nodeId) == 0 && len(s.metric) > 0 && len(s.indexMetric) > 0 {
		path, err = uritemplates.Expand("/_nodes/stats/{metric}/{index_metric}", map[string]string{
			"index_metric": strings.Join(s.indexMetric, ","),
			"metric":       strings.Join(s.metric, ","),
		})
	} else if len(s.nodeId) == 0 && len(s.metric) > 0 && len(s.indexMetric) == 0 {
		path, err = uritemplates.Expand("/_nodes/stats/{metric}", map[string]string{
			"metric": strings.Join(s.metric, ","),
		})
	} else if len(s.nodeId) == 0 && len(s.metric) == 0 && len(s.indexMetric) > 0 {
		path, err = uritemplates.Expand("/_nodes/stats/_all/{index_metric}", map[string]string{
			"index_metric": strings.Join(s.indexMetric, ","),
		})
	} else { // if len(s.nodeId) == 0 && len(s.metric) == 0 && len(s.indexMetric) == 0 {
		path = "/_nodes/stats"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if len(s.completionFields) > 0 {
		params.Set("completion_fields", strings.Join(s.completionFields, ","))
	}
	if len(s.fielddataFields) > 0 {
		params.Set("fielddata_fields", strings.Join(s.fielddataFields, ","))
	}
	if len(s.fields) > 0 {
		params.Set("fields", strings.Join(s.fields, ","))
	}
	if s.groups != nil {
		params.Set("groups", fmt.Sprintf("%v", *s.groups))
	}
	if s.human != nil {
		params.Set("human", fmt.Sprintf("%v", *s.human))
	}
	if s.level != "" {
		params.Set("level", s.level)
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if len(s.types) > 0 {
		params.Set("types", strings.Join(s.types, ","))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *NodesStatsService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *NodesStatsService) Do() (*NodesStatsResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *NodesStatsService) DoC(ctx context.Context) (*NodesStatsResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(NodesStatsResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// NodesStatsResponse is the response of NodesStatsService.Do.
type NodesStatsResponse struct {
	ClusterName string                     `json:"cluster_name"`
	Nodes       map[string]*NodesStatsNode `json:"nodes"`
}

type NodesStatsNode struct {
	// Timestamp when these stats we're gathered.
	Timestamp int64 `json:"timestamp"`
	// Name of the node, e.g. "Mister Fear"
	Name string `json:"name"`
	// TransportAddress, e.g. "127.0.0.1:9300"
	TransportAddress string `json:"transport_address"`
	// Host is the host name, e.g. "macbookair"
	Host string `json:"host"`
	// IP is the list of IP addresses, e.g. ["192.168.1.2"]
	IP []string `json:"ip"`

	// Attributes of the node.
	Attributes map[string]interface{} `json:"attributes"`

	// Indices returns index information.
	Indices *NodesStatsIndex `json:"indices"`

	// OS information, e.g. CPU and memory.
	OS *NodesStatsNodeOS `json:"os"`

	// Process information, e.g. max file descriptors.
	Process *NodesStatsNodeProcess `json:"process"`

	// JVM information, e.g. VM version.
	JVM *NodesStatsNodeJVM `json:"jvm"`

	// ThreadPool information.
	ThreadPool map[string]*NodesStatsNodeThreadPool `json:"thread_pool"`

	// FS returns information about the filesystem.
	FS *NodesStatsNodeFS `json:"fs"`

	// Network information.
	Transport *NodesStatsNodeTransport `json:"transport"`

	// HTTP information.
	HTTP *NodesStatsNodeHTTP `json:"http"`

	// Breaker contains information about circuit breakers.
	Breaker map[string]*NodesStatsBreaker `json:"breaker"`

	// ScriptStats information.
	ScriptStats *NodesStatsScriptStats `json:"script"`
}

type NodesStatsIndex struct {
	Docs         *NodesStatsDocsStats         `json:"docs"`
	Store        *NodesStatsStoreStats        `json:"store"`
	Indexing     *NodesStatsIndexingStats     `json:"indexing"`
	Get          *NodesStatsGetStats          `json:"get"`
	Search       *NodesStatsSearchStats       `json:"search"`
	Merges       *NodesStatsMergeStats        `json:"merges"`
	Refresh      *NodesStatsRefreshStats      `json:"refresh"`
	Flush        *NodesStatsFlushStats        `json:"flush"`
	Warmer       *NodesStatsWarmerStats       `json:"warmer"`
	QueryCache   *NodesStatsQueryCacheStats   `json:"query_cache"`
	Fielddata    *NodesStatsFielddataStats    `json:"fielddata"`
	Percolate    *NodesStatsPercolateStats    `json:"percolate"`
	Completion   *NodesStatsCompletionStats   `json:"completion"`
	Segments     *NodesStatsSegmentsStats     `json:"segments"`
	Translog     *NodesStatsTranslogStats     `json:"translog"`
	Suggest      *NodesStatsSuggestStats      `json:"suggest"`
	RequestCache *NodesStatsRequestCacheStats `json:"request_cache"`
	Recovery     NodesStatsRecoveryStats      `json:"recovery"`

	Indices map[string]*NodesStatsIndex `json:"indices"` // for level=indices
	Shards  map[string]*NodesStatsIndex `json:"shards"`  // for level=shards
}

type NodesStatsDocsStats struct {
	Count   int64 `json:"count"`
	Deleted int64 `json:"deleted"`
}

type NodesStatsStoreStats struct {
	Size                 string `json:"size"`
	SizeInBytes          int64  `json:"size_in_bytes"`
	ThrottleTime         string `json:"throttle_time"`
	ThrottleTimeInMillis int64  `json:"throttle_time_in_millis"`
}

type NodesStatsIndexingStats struct {
	IndexTotal           int64  `json:"index_total"`
	IndexTime            string `json:"index_time"`
	IndexTimeInMillis    int64  `json:"index_time_in_millis"`
	IndexCurrent         int64  `json:"index_current"`
	IndexFailed          int64  `json:"index_failed"`
	DeleteTotal          int64  `json:"delete_total"`
	DeleteTime           string `json:"delete_time"`
	DeleteTimeInMillis   int64  `json:"delete_time_in_millis"`
	DeleteCurrent        int64  `json:"delete_current"`
	NoopUpdateTotal      int64  `json:"noop_update_total"`
	IsThrottled          bool   `json:"is_throttled"`
	ThrottleTime         string `json:"throttle_time"`
	ThrottleTimeInMillis int64  `json:"throttle_time_in_millis"`

	Types map[string]*NodesStatsIndexingStats `json:"types"` // stats for individual types
}

type NodesStatsGetStats struct {
	Total               int64  `json:"total"`
	Time                string `json:"get_time"`
	TimeInMillis        int64  `json:"time_in_millis"`
	Exists              int64  `json:"exists"`
	ExistsTime          string `json:"exists_time"`
	ExistsTimeInMillis  int64  `json:"exists_in_millis"`
	Missing             int64  `json:"missing"`
	MissingTime         string `json:"missing_time"`
	MissingTimeInMillis int64  `json:"missing_in_millis"`
	Current             int64  `json:"current"`
}

type NodesStatsSearchStats struct {
	OpenContexts       int64  `json:"open_contexts"`
	QueryTotal         int64  `json:"query_total"`
	QueryTime          string `json:"query_time"`
	QueryTimeInMillis  int64  `json:"query_time_in_millis"`
	QueryCurrent       int64  `json:"query_current"`
	FetchTotal         int64  `json:"fetch_total"`
	FetchTime          string `json:"fetch_time"`
	FetchTimeInMillis  int64  `json:"fetch_time_in_millis"`
	FetchCurrent       int64  `json:"fetch_current"`
	ScrollTotal        int64  `json:"scroll_total"`
	ScrollTime         string `json:"scroll_time"`
	ScrollTimeInMillis int64  `json:"scroll_time_in_millis"`
	ScrollCurrent      int64  `json:"scroll_current"`

	Groups map[string]*NodesStatsSearchStats `json:"groups"` // stats for individual groups
}

type NodesStatsMergeStats struct {
	Current                    int64  `json:"current"`
	CurrentDocs                int64  `json:"current_docs"`
	CurrentSize                string `json:"current_size"`
	CurrentSizeInBytes         int64  `json:"current_size_in_bytes"`
	Total                      int64  `json:"total"`
	TotalTime                  string `json:"total_time"`
	TotalTimeInMillis          int64  `json:"total_time_in_millis"`
	TotalDocs                  int64  `json:"total_docs"`
	TotalSize                  string `json:"total_size"`
	TotalSizeInBytes           int64  `json:"total_size_in_bytes"`
	TotalStoppedTime           string `json:"total_stopped_time"`
	TotalStoppedTimeInMillis   int64  `json:"total_stopped_time_in_millis"`
	TotalThrottledTime         string `json:"total_throttled_time"`
	TotalThrottledTimeInMillis int64  `json:"total_throttled_time_in_millis"`
	TotalThrottleBytes         string `json:"total_auto_throttle"`
	TotalThrottleBytesInBytes  int64  `json:"total_auto_throttle_in_bytes"`
}

type NodesStatsRefreshStats struct {
	Total             int64  `json:"total"`
	TotalTime         string `json:"total_time"`
	TotalTimeInMillis int64  `json:"total_time_in_millis"`
}

type NodesStatsFlushStats struct {
	Total             int64  `json:"total"`
	TotalTime         string `json:"total_time"`
	TotalTimeInMillis int64  `json:"total_time_in_millis"`
}

type NodesStatsWarmerStats struct {
	Current           int64  `json:"current"`
	Total             int64  `json:"total"`
	TotalTime         string `json:"total_time"`
	TotalTimeInMillis int64  `json:"total_time_in_millis"`
}

type NodesStatsQueryCacheStats struct {
	MemorySize        string `json:"memory_size"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes"`
	TotalCount        int64  `json:"total_count"`
	HitCount          int64  `json:"hit_count"`
	MissCount         int64  `json:"miss_count"`
	CacheSize         int64  `json:"cache_size"`
	CacheCount        int64  `json:"cache_count"`
	Evictions         int64  `json:"evictions"`
}

type NodesStatsFielddataStats struct {
	MemorySize        string `json:"memory_size"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes"`
	Evictions         int64  `json:"evictions"`
	Fields            map[string]struct {
		MemorySize        string `json:"memory_size"`
		MemorySizeInBytes int64  `json:"memory_size_in_bytes"`
	} `json:"fields"`
}

type NodesStatsPercolateStats struct {
	Total             int64  `json:"total"`
	Time              string `json:"time"`
	TimeInMillis      int64  `json:"time_in_millis"`
	Current           int64  `json:"current"`
	MemorySize        string `json:"memory_size"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes"`
	Queries           int64  `json:"queries"`
}

type NodesStatsCompletionStats struct {
	Size        string `json:"size"`
	SizeInBytes int64  `json:"size_in_bytes"`
	Fields      map[string]struct {
		Size        string `json:"size"`
		SizeInBytes int64  `json:"size_in_bytes"`
	} `json:"fields"`
}

type NodesStatsSegmentsStats struct {
	Count                       int64  `json:"count"`
	Memory                      string `json:"memory"`
	MemoryInBytes               int64  `json:"memory_in_bytes"`
	TermsMemory                 string `json:"terms_memory"`
	TermsMemoryInBytes          int64  `json:"terms_memory_in_bytes"`
	StoredFieldsMemory          string `json:"stored_fields_memory"`
	StoredFieldsMemoryInBytes   int64  `json:"stored_fields_memory_in_bytes"`
	TermVectorsMemory           string `json:"term_vectors_memory"`
	TermVectorsMemoryInBytes    int64  `json:"term_vectors_memory_in_bytes"`
	NormsMemory                 string `json:"norms_memory"`
	NormsMemoryInBytes          int64  `json:"norms_memory_in_bytes"`
	DocValuesMemory             string `json:"doc_values_memory"`
	DocValuesMemoryInBytes      int64  `json:"doc_values_memory_in_bytes"`
	IndexWriterMemory           string `json:"index_writer_memory"`
	IndexWriterMemoryInBytes    int64  `json:"index_writer_memory_in_bytes"`
	IndexWriterMaxMemory        string `json:"index_writer_max_memory"`
	IndexWriterMaxMemoryInBytes int64  `json:"index_writer_max_memory_in_bytes"`
	VersionMapMemory            string `json:"version_map_memory"`
	VersionMapMemoryInBytes     int64  `json:"version_map_memory_in_bytes"`
	FixedBitSetMemory           string `json:"fixed_bit_set"` // not a typo
	FixedBitSetMemoryInBytes    int64  `json:"fixed_bit_set_memory_in_bytes"`
}

type NodesStatsTranslogStats struct {
	Operations  int64  `json:"operations"`
	Size        string `json:"size"`
	SizeInBytes int64  `json:"size_in_bytes"`
}

type NodesStatsSuggestStats struct {
	Total             int64  `json:"total"`
	TotalTime         string `json:"total_time"`
	TotalTimeInMillis int64  `json:"total_time_in_millis"`
	Current           int64  `json:"current"`
}

type NodesStatsRequestCacheStats struct {
	MemorySize        string `json:"memory_size"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes"`
	Evictions         int64  `json:"evictions"`
	HitCount          int64  `json:"hit_count"`
	MissCount         int64  `json:"miss_count"`
}

type NodesStatsRecoveryStats struct {
	CurrentAsSource      int    `json:"current_as_source"`
	CurrentAsTarget      int    `json:"current_as_target"`
	ThrottleTime         string `json:"throttle_time"`
	ThrottleTimeInMillis int64  `json:"throttle_time_in_millis"`
}

type NodesStatsNodeOS struct {
	Timestamp   int64                 `json:"timestamp"`
	CPUPercent  int                   `json:"cpu_percent"`
	LoadAverage float64               `json:"load_average"`
	Mem         *NodesStatsNodeOSMem  `json:"mem"`
	Swap        *NodesStatsNodeOSSwap `json:"swap"`
}

type NodesStatsNodeOSMem struct {
	Total        string `json:"total"`
	TotalInBytes int64  `json:"total_in_bytes"`
	Free         string `json:"free"`
	FreeInBytes  int64  `json:"free_in_bytes"`
	Used         string `json:"used"`
	UsedInBytes  int64  `json:"used_in_bytes"`
	FreePercent  int    `json:"free_percent"`
	UsedPercent  int    `json:"used_percent"`
}

type NodesStatsNodeOSSwap struct {
	Total        string `json:"total"`
	TotalInBytes int64  `json:"total_in_bytes"`
	Free         string `json:"free"`
	FreeInBytes  int64  `json:"free_in_bytes"`
	Used         string `json:"used"`
	UsedInBytes  int64  `json:"used_in_bytes"`
}

type NodesStatsNodeProcess struct {
	Timestamp           int64 `json:"timestamp"`
	OpenFileDescriptors int64 `json:"open_file_descriptors"`
	MaxFileDescriptors  int64 `json:"max_file_descriptors"`
	CPU                 struct {
		Percent       int    `json:"percent"`
		Total         string `json:"total"`
		TotalInMillis int64  `json:"total_in_millis"`
	} `json:"cpu"`
	Mem struct {
		TotalVirtual        string `json:"total_virtual"`
		TotalVirtualInBytes int64  `json:"total_virtual_in_bytes"`
	} `json:"mem"`
}

type NodesStatsNodeJVM struct {
	Timestamp      int64                                   `json:"timestamp"`
	Uptime         string                                  `json:"uptime"`
	UptimeInMillis int64                                   `json:"uptime_in_millis"`
	Mem            *NodesStatsNodeJVMMem                   `json:"mem"`
	Threads        *NodesStatsNodeJVMThreads               `json:"threads"`
	GC             *NodesStatsNodeJVMGC                    `json:"gc"`
	BufferPools    map[string]*NodesStatsNodeJVMBufferPool `json:"buffer_pools"`
	Classes        *NodesStatsNodeJVMClasses               `json:"classes"`
}

type NodesStatsNodeJVMMem struct {
	HeapUsed                string `json:"heap_used"`
	HeapUsedInBytes         int64  `json:"heap_used_in_bytes"`
	HeapUsedPercent         int    `json:"heap_used_percent"`
	HeapCommitted           string `json:"heap_committed"`
	HeapCommittedInBytes    int64  `json:"heap_committed_in_bytes"`
	HeapMax                 string `json:"heap_max"`
	HeapMaxInBytes          int64  `json:"heap_max_in_bytes"`
	NonHeapUsed             string `json:"non_heap_used"`
	NonHeapUsedInBytes      int64  `json:"non_heap_used_in_bytes"`
	NonHeapCommitted        string `json:"non_heap_committed"`
	NonHeapCommittedInBytes int64  `json:"non_heap_committed_in_bytes"`
	Pools                   map[string]struct {
		Used            string `json:"used"`
		UsedInBytes     int64  `json:"used_in_bytes"`
		Max             string `json:"max"`
		MaxInBytes      int64  `json:"max_in_bytes"`
		PeakUsed        string `json:"peak_used"`
		PeakUsedInBytes int64  `json:"peak_used_in_bytes"`
		PeakMax         string `json:"peak_max"`
		PeakMaxInBytes  int64  `json:"peak_max_in_bytes"`
	} `json:"pools"`
}

type NodesStatsNodeJVMThreads struct {
	Count     int64 `json:"count"`
	PeakCount int64 `json:"peak_count"`
}

type NodesStatsNodeJVMGC struct {
	Collectors map[string]*NodesStatsNodeJVMGCCollector `json:"collectors"`
}

type NodesStatsNodeJVMGCCollector struct {
	CollectionCount        int64  `json:"collection_count"`
	CollectionTime         string `json:"collection_time"`
	CollectionTimeInMillis int64  `json:"collection_time_in_millis"`
}

type NodesStatsNodeJVMBufferPool struct {
	Count                int64  `json:"count"`
	TotalCapacity        string `json:"total_capacity"`
	TotalCapacityInBytes int64  `json:"total_capacity_in_bytes"`
}

type NodesStatsNodeJVMClasses struct {
	CurrentLoadedCount int64 `json:"current_loaded_count"`
	TotalLoadedCount   int64 `json:"total_loaded_count"`
	TotalUnloadedCount int64 `json:"total_unloaded_count"`
}

type NodesStatsNodeThreadPool struct {
	Threads   int   `json:"threads"`
	Queue     int   `json:"queue"`
	Active    int   `json:"active"`
	Rejected  int64 `json:"rejected"`
	Largest   int   `json:"largest"`
	Completed int64 `json:"completed"`
}

type NodesStatsNodeFS struct {
	Timestamp int64                    `json:"timestamp"`
	Total     *NodesStatsNodeFSEntry   `json:"total"`
	Data      []*NodesStatsNodeFSEntry `json:"data"`
}

type NodesStatsNodeFSEntry struct {
	Path             string `json:"path"`
	Mount            string `json:"mount"`
	Type             string `json:"type"`
	Total            string `json:"total"`
	TotalInBytes     int64  `json:"total_in_bytes"`
	Free             string `json:"free"`
	FreeInBytes      int64  `json:"free_in_bytes"`
	Available        string `json:"available"`
	AvailableInBytes int64  `json:"available_in_bytes"`
	Spins            string `json:"spins"`
}

type NodesStatsNodeTransport struct {
	ServerOpen    int    `json:"server_open"`
	RxCount       int64  `json:"rx_count"`
	RxSize        string `json:"rx_size"`
	RxSizeInBytes int64  `json:"rx_size_in_bytes"`
	TxCount       int64  `json:"tx_count"`
	TxSize        string `json:"tx_size"`
	TxSizeInBytes int64  `json:"tx_size_in_bytes"`
}

type NodesStatsNodeHTTP struct {
	CurrentOpen int `json:"current_open"`
	TotalOpened int `json:"total_opened"`
}

type NodesStatsBreaker struct {
	LimitSize            string  `json:"limit_size"`
	LimitSizeInBytes     int64   `json:"limit_size_in_bytes"`
	EstimatedSize        string  `json:"estimated_size"`
	EstimatedSizeInBytes int64   `json:"estimated_size_in_bytes"`
	Overhead             float64 `json:"overhead"`
	Tripped              int64   `json:"tripped"`
}

type NodesStatsScriptStats struct {
	Compilations   int64 `json:"compilations"`
	CacheEvictions int64 `json:"cache_evictions"`
}
