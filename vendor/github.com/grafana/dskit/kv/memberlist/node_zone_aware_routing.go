package memberlist

import (
	"flag"
	"fmt"
	"math/rand"
	"slices"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/hashicorp/memberlist"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// NodeRole represents the role of a node in the memberlist cluster.
type NodeRole uint8

const (
	// NodeRoleMember represents a standard member node.
	NodeRoleMember NodeRole = 1
	// NodeRoleBridge represents a bridge node that connects different zones.
	NodeRoleBridge NodeRole = 2
)

// String returns the string representation of the node role.
func (r NodeRole) String() string {
	switch r {
	case NodeRoleMember:
		return "member"
	case NodeRoleBridge:
		return "bridge"
	default:
		return fmt.Sprintf("unknown(%d)", r)
	}
}

const (
	// MaxZoneNameLength is the maximum zone name length (to keep metadata compact).
	MaxZoneNameLength = 16

	// Role configuration values.
	roleConfigMember = "member"
	roleConfigBridge = "bridge"
)

// ZoneAwareRoutingConfig holds configuration for zone-aware routing in memberlist.
type ZoneAwareRoutingConfig struct {
	Enabled bool   `yaml:"enabled" category:"experimental"`
	Zone    string `yaml:"instance_availability_zone" category:"experimental"`
	Role    string `yaml:"role" category:"experimental"`
}

// RegisterFlagsWithPrefix registers flags with the given prefix.
func (cfg *ZoneAwareRoutingConfig) RegisterFlagsWithPrefix(f *flag.FlagSet, prefix string) {
	f.BoolVar(&cfg.Enabled, prefix+"enabled", false, "Enable zone-aware routing for memberlist gossip.")
	f.StringVar(&cfg.Zone, prefix+"instance-availability-zone", "", "Availability zone where this node is running.")
	f.StringVar(&cfg.Role, prefix+"role", roleConfigMember, fmt.Sprintf("Role of this node in the cluster. Valid values: %s, %s.", roleConfigMember, roleConfigBridge))
}

// Validate validates the zone-aware routing configuration.
func (cfg *ZoneAwareRoutingConfig) Validate() error {
	// Only validate if enabled.
	if !cfg.Enabled {
		return nil
	}

	// Zone must be set.
	if cfg.Zone == "" {
		return fmt.Errorf("zone-aware routing is enabled but zone is not set")
	}

	// Zone length must not exceed maximum.
	if len(cfg.Zone) > MaxZoneNameLength {
		return fmt.Errorf("zone name too long: %d bytes (max %d)", len(cfg.Zone), MaxZoneNameLength)
	}

	// Role must be valid.
	if cfg.Role != NodeRoleMember.String() && cfg.Role != NodeRoleBridge.String() {
		return fmt.Errorf("invalid role: %s (valid values: %s, %s)", cfg.Role, NodeRoleMember.String(), NodeRoleBridge.String())
	}

	return nil
}

// zoneAwareNodeSelectionDelegate implements the memberlist.NodeSelectionDelegate interface
// to provide zone-aware routing for gossip, probing, and push/pull operations.
type zoneAwareNodeSelectionDelegate struct {
	localRole NodeRole
	localZone string
	logger    log.Logger

	// Metrics
	selectNodesCalls        prometheus.Counter
	selectNodesCallsSkipped prometheus.Counter
}

// newZoneAwareNodeSelectionDelegate creates a new zone-aware node selection delegate.
func newZoneAwareNodeSelectionDelegate(localRole NodeRole, localZone string, logger log.Logger, registerer prometheus.Registerer) *zoneAwareNodeSelectionDelegate {
	return &zoneAwareNodeSelectionDelegate{
		localRole: localRole,
		localZone: localZone,
		logger:    logger,
		selectNodesCalls: promauto.With(registerer).NewCounter(prometheus.CounterOpts{
			Name: "memberlist_client_zone_aware_routing_select_nodes_total",
			Help: "Total number of times memberlist attempted to select node candidates for gossiping (tracked only when when zone-aware routing is enabled).",
		}),
		selectNodesCallsSkipped: promauto.With(registerer).NewCounter(prometheus.CounterOpts{
			Name: "memberlist_client_zone_aware_routing_select_nodes_skipped_total",
			Help: "Total number of times memberlist zone-aware routing was skipped because the local zone is unknown or a zone has no alive bridges.",
		}),
	}
}

// SelectNodes implements memberlist.NodeSelectionDelegate.
// It determines which remote nodes should be selected for gossip operations and which one should be preferred.
func (d *zoneAwareNodeSelectionDelegate) SelectNodes(nodes []*memberlist.NodeState) (selected []*memberlist.NodeState, preferred *memberlist.NodeState) {
	d.selectNodesCalls.Inc()

	if d.localRole != NodeRoleMember && d.localRole != NodeRoleBridge {
		level.Warn(d.logger).Log("msg", "memberlist zone-aware routing is running with an unknown role", "role", d.localRole)
	}

	// Skip zone-aware routing if local zone is not set.
	if d.localZone == "" {
		d.selectNodesCallsSkipped.Inc()
		return nodes, nil
	}

	// Pre-allocate backing arrays on the stack for up to 5 zones (common case).
	zonesWithMembers := make([]string, 0, 5)
	zonesWithAliveBridges := make([]string, 0, 5)

	// Build selected slice and track zones in a single pass.
	selected = make([]*memberlist.NodeState, 0, len(nodes))
	preferredCount := 0 // Count of preferred candidates seen (for reservoir sampling).

	for _, node := range nodes {
		remoteMeta := EncodedNodeMetadata(node.Meta)
		remoteZone := remoteMeta.Zone()
		remoteRole := remoteMeta.Role()

		// Track zones to check if any zone has members but no alive bridges.
		if remoteZone != "" {
			if remoteRole == NodeRoleBridge {
				// Only count alive bridges.
				if node.State == memberlist.StateAlive {
					if !containsZone(zonesWithAliveBridges, remoteZone) {
						zonesWithAliveBridges = append(zonesWithAliveBridges, remoteZone)
						slices.Sort(zonesWithAliveBridges)
					}
				}
			} else {
				if !containsZone(zonesWithMembers, remoteZone) {
					zonesWithMembers = append(zonesWithMembers, remoteZone)
					slices.Sort(zonesWithMembers)
				}
			}
		}

		// Apply zone-aware selection.
		isSelected, isPreferred := d.selectNode(remoteZone, remoteRole)
		if isSelected {
			selected = append(selected, node)
			if isPreferred {
				preferredCount++
				// Reservoir sampling: select this node with a probability of 1/preferredCount.
				if rand.Intn(preferredCount) == 0 {
					preferred = node
				}
			}
		}
	}

	// Skip zone-aware routing if any zone has members but no alive bridges.
	// This prevents network partitioning when bridges are missing or dead.
	for _, zone := range zonesWithMembers {
		if !slices.Contains(zonesWithAliveBridges, zone) {
			d.selectNodesCallsSkipped.Inc()
			level.Warn(d.logger).Log("msg", "memberlist zone-aware routing is skipped because a zone has no alive bridge", "zone", zone)
			return nodes, nil
		}
	}

	return selected, preferred
}

// selectNode determines whether a remote node should be selected for gossip operations
// and whether it should be considered a preferred candidate.
func (d *zoneAwareNodeSelectionDelegate) selectNode(remoteZone string, remoteRole NodeRole) (selected, preferredCandidate bool) {
	// If the remote zone is unknown, select the node but don't prefer it.
	// This prevents network partitioning: if every other memberlist node filters it out, then that
	// remote node would not receive updates and would get isolated.
	if remoteZone == "" {
		return true, false
	}

	switch d.localRole {
	case NodeRoleMember:
		// Members only select nodes in the same zone.
		if remoteZone == d.localZone {
			return true, false
		}
		return false, false

	case NodeRoleBridge:
		// Bridges select nodes in the same zone + bridge nodes in other zones.
		if remoteZone == d.localZone {
			// Same zone: select but don't prefer.
			return true, false
		}
		// Different zone: only select if it's a bridge node, and prefer it.
		if remoteRole == NodeRoleBridge {
			return true, true
		}
		return false, false

	default:
		// Unknown role: select but don't prefer (should never happen).
		return true, false
	}
}

// containsZone checks whether zones slice contains a given zone.
// It's optimized for a sorted zones slice, and zones that end with 'a' to 'z'.
// When all zones from 'a' to last one are present, it attempts to check only the expected position.
func containsZone(zones []string, zone string) bool {
	if zone == "" {
		return slices.Contains(zones, zone)
	}
	optimisticIndex := int(zone[len(zone)-1]) - 'a'
	if optimisticIndex < 0 || len(zones) <= optimisticIndex {
		return slices.Contains(zones, zone)
	}

	if zones[optimisticIndex] == zone {
		return true // Here's where we skip the strings check.
	}

	// Bad luck, just check slices.Contains.
	return slices.Contains(zones, zone)
}
