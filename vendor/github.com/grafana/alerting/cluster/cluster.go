package cluster

import (
	"github.com/prometheus/alertmanager/cluster"
)

const (
	DefaultGossipInterval    = cluster.DefaultGossipInterval
	DefaultPushPullInterval  = cluster.DefaultPushPullInterval
	DefaultProbeInterval     = cluster.DefaultProbeInterval
	DefaultProbeTimeout      = cluster.DefaultProbeTimeout
	DefaultReconnectInterval = cluster.DefaultReconnectInterval
	DefaultReconnectTimeout  = cluster.DefaultReconnectTimeout
	DefaultTCPTimeout        = cluster.DefaultTCPTimeout
)

var (
	Create = cluster.Create
)

type ClusterChannel = cluster.ClusterChannel //nolint:revive
type Peer = cluster.Peer
type State = cluster.State
