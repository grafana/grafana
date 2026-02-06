package volume

import (
	"github.com/docker/docker/api/types/swarm"
)

// ClusterVolume contains options and information specific to, and only present
// on, Swarm CSI cluster volumes.
type ClusterVolume struct {
	// ID is the Swarm ID of the volume. Because cluster volumes are Swarm
	// objects, they have an ID, unlike non-cluster volumes, which only have a
	// Name. This ID can be used to refer to the cluster volume.
	ID string

	// Meta is the swarm metadata about this volume.
	swarm.Meta

	// Spec is the cluster-specific options from which this volume is derived.
	Spec ClusterVolumeSpec

	// PublishStatus contains the status of the volume as it pertains to its
	// publishing on Nodes.
	PublishStatus []*PublishStatus `json:",omitempty"`

	// Info is information about the global status of the volume.
	Info *Info `json:",omitempty"`
}

// ClusterVolumeSpec contains the spec used to create this volume.
type ClusterVolumeSpec struct {
	// Group defines the volume group of this volume. Volumes belonging to the
	// same group can be referred to by group name when creating Services.
	// Referring to a volume by group instructs swarm to treat volumes in that
	// group interchangeably for the purpose of scheduling. Volumes with an
	// empty string for a group technically all belong to the same, emptystring
	// group.
	Group string `json:",omitempty"`

	// AccessMode defines how the volume is used by tasks.
	AccessMode *AccessMode `json:",omitempty"`

	// AccessibilityRequirements specifies where in the cluster a volume must
	// be accessible from.
	//
	// This field must be empty if the plugin does not support
	// VOLUME_ACCESSIBILITY_CONSTRAINTS capabilities. If it is present but the
	// plugin does not support it, volume will not be created.
	//
	// If AccessibilityRequirements is empty, but the plugin does support
	// VOLUME_ACCESSIBILITY_CONSTRAINTS, then Swarmkit will assume the entire
	// cluster is a valid target for the volume.
	AccessibilityRequirements *TopologyRequirement `json:",omitempty"`

	// CapacityRange defines the desired capacity that the volume should be
	// created with. If nil, the plugin will decide the capacity.
	CapacityRange *CapacityRange `json:",omitempty"`

	// Secrets defines Swarm Secrets that are passed to the CSI storage plugin
	// when operating on this volume.
	Secrets []Secret `json:",omitempty"`

	// Availability is the Volume's desired availability. Analogous to Node
	// Availability, this allows the user to take volumes offline in order to
	// update or delete them.
	Availability Availability `json:",omitempty"`
}

// Availability specifies the availability of the volume.
type Availability string

const (
	// AvailabilityActive indicates that the volume is active and fully
	// schedulable on the cluster.
	AvailabilityActive Availability = "active"

	// AvailabilityPause indicates that no new workloads should use the
	// volume, but existing workloads can continue to use it.
	AvailabilityPause Availability = "pause"

	// AvailabilityDrain indicates that all workloads using this volume
	// should be rescheduled, and the volume unpublished from all nodes.
	AvailabilityDrain Availability = "drain"
)

// AccessMode defines the access mode of a volume.
type AccessMode struct {
	// Scope defines the set of nodes this volume can be used on at one time.
	Scope Scope `json:",omitempty"`

	// Sharing defines the number and way that different tasks can use this
	// volume at one time.
	Sharing SharingMode `json:",omitempty"`

	// MountVolume defines options for using this volume as a Mount-type
	// volume.
	//
	// Either BlockVolume or MountVolume, but not both, must be present.
	MountVolume *TypeMount `json:",omitempty"`

	// BlockVolume defines options for using this volume as a Block-type
	// volume.
	//
	// Either BlockVolume or MountVolume, but not both, must be present.
	BlockVolume *TypeBlock `json:",omitempty"`
}

// Scope defines the Scope of a Cluster Volume. This is how many nodes a
// Volume can be accessed simultaneously on.
type Scope string

const (
	// ScopeSingleNode indicates the volume can be used on one node at a
	// time.
	ScopeSingleNode Scope = "single"

	// ScopeMultiNode indicates the volume can be used on many nodes at
	// the same time.
	ScopeMultiNode Scope = "multi"
)

// SharingMode defines the Sharing of a Cluster Volume. This is how Tasks using a
// Volume at the same time can use it.
type SharingMode string

const (
	// SharingNone indicates that only one Task may use the Volume at a
	// time.
	SharingNone SharingMode = "none"

	// SharingReadOnly indicates that the Volume may be shared by any
	// number of Tasks, but they must be read-only.
	SharingReadOnly SharingMode = "readonly"

	// SharingOneWriter indicates that the Volume may be shared by any
	// number of Tasks, but all after the first must be read-only.
	SharingOneWriter SharingMode = "onewriter"

	// SharingAll means that the Volume may be shared by any number of
	// Tasks, as readers or writers.
	SharingAll SharingMode = "all"
)

// TypeBlock defines options for using a volume as a block-type volume.
//
// Intentionally empty.
type TypeBlock struct{}

// TypeMount contains options for using a volume as a Mount-type
// volume.
type TypeMount struct {
	// FsType specifies the filesystem type for the mount volume. Optional.
	FsType string `json:",omitempty"`

	// MountFlags defines flags to pass when mounting the volume. Optional.
	MountFlags []string `json:",omitempty"`
}

// TopologyRequirement expresses the user's requirements for a volume's
// accessible topology.
type TopologyRequirement struct {
	// Requisite specifies a list of Topologies, at least one of which the
	// volume must be accessible from.
	//
	// Taken verbatim from the CSI Spec:
	//
	// Specifies the list of topologies the provisioned volume MUST be
	// accessible from.
	// This field is OPTIONAL. If TopologyRequirement is specified either
	// requisite or preferred or both MUST be specified.
	//
	// If requisite is specified, the provisioned volume MUST be
	// accessible from at least one of the requisite topologies.
	//
	// Given
	//   x = number of topologies provisioned volume is accessible from
	//   n = number of requisite topologies
	// The CO MUST ensure n >= 1. The SP MUST ensure x >= 1
	// If x==n, then the SP MUST make the provisioned volume available to
	// all topologies from the list of requisite topologies. If it is
	// unable to do so, the SP MUST fail the CreateVolume call.
	// For example, if a volume should be accessible from a single zone,
	// and requisite =
	//   {"region": "R1", "zone": "Z2"}
	// then the provisioned volume MUST be accessible from the "region"
	// "R1" and the "zone" "Z2".
	// Similarly, if a volume should be accessible from two zones, and
	// requisite =
	//   {"region": "R1", "zone": "Z2"},
	//   {"region": "R1", "zone": "Z3"}
	// then the provisioned volume MUST be accessible from the "region"
	// "R1" and both "zone" "Z2" and "zone" "Z3".
	//
	// If x<n, then the SP SHALL choose x unique topologies from the list
	// of requisite topologies. If it is unable to do so, the SP MUST fail
	// the CreateVolume call.
	// For example, if a volume should be accessible from a single zone,
	// and requisite =
	//   {"region": "R1", "zone": "Z2"},
	//   {"region": "R1", "zone": "Z3"}
	// then the SP may choose to make the provisioned volume available in
	// either the "zone" "Z2" or the "zone" "Z3" in the "region" "R1".
	// Similarly, if a volume should be accessible from two zones, and
	// requisite =
	//   {"region": "R1", "zone": "Z2"},
	//   {"region": "R1", "zone": "Z3"},
	//   {"region": "R1", "zone": "Z4"}
	// then the provisioned volume MUST be accessible from any combination
	// of two unique topologies: e.g. "R1/Z2" and "R1/Z3", or "R1/Z2" and
	//  "R1/Z4", or "R1/Z3" and "R1/Z4".
	//
	// If x>n, then the SP MUST make the provisioned volume available from
	// all topologies from the list of requisite topologies and MAY choose
	// the remaining x-n unique topologies from the list of all possible
	// topologies. If it is unable to do so, the SP MUST fail the
	// CreateVolume call.
	// For example, if a volume should be accessible from two zones, and
	// requisite =
	//   {"region": "R1", "zone": "Z2"}
	// then the provisioned volume MUST be accessible from the "region"
	// "R1" and the "zone" "Z2" and the SP may select the second zone
	// independently, e.g. "R1/Z4".
	Requisite []Topology `json:",omitempty"`

	// Preferred is a list of Topologies that the volume should attempt to be
	// provisioned in.
	//
	// Taken from the CSI spec:
	//
	// Specifies the list of topologies the CO would prefer the volume to
	// be provisioned in.
	//
	// This field is OPTIONAL. If TopologyRequirement is specified either
	// requisite or preferred or both MUST be specified.
	//
	// An SP MUST attempt to make the provisioned volume available using
	// the preferred topologies in order from first to last.
	//
	// If requisite is specified, all topologies in preferred list MUST
	// also be present in the list of requisite topologies.
	//
	// If the SP is unable to make the provisioned volume available
	// from any of the preferred topologies, the SP MAY choose a topology
	// from the list of requisite topologies.
	// If the list of requisite topologies is not specified, then the SP
	// MAY choose from the list of all possible topologies.
	// If the list of requisite topologies is specified and the SP is
	// unable to make the provisioned volume available from any of the
	// requisite topologies it MUST fail the CreateVolume call.
	//
	// Example 1:
	// Given a volume should be accessible from a single zone, and
	// requisite =
	//   {"region": "R1", "zone": "Z2"},
	//   {"region": "R1", "zone": "Z3"}
	// preferred =
	//   {"region": "R1", "zone": "Z3"}
	// then the SP SHOULD first attempt to make the provisioned volume
	// available from "zone" "Z3" in the "region" "R1" and fall back to
	// "zone" "Z2" in the "region" "R1" if that is not possible.
	//
	// Example 2:
	// Given a volume should be accessible from a single zone, and
	// requisite =
	//   {"region": "R1", "zone": "Z2"},
	//   {"region": "R1", "zone": "Z3"},
	//   {"region": "R1", "zone": "Z4"},
	//   {"region": "R1", "zone": "Z5"}
	// preferred =
	//   {"region": "R1", "zone": "Z4"},
	//   {"region": "R1", "zone": "Z2"}
	// then the SP SHOULD first attempt to make the provisioned volume
	// accessible from "zone" "Z4" in the "region" "R1" and fall back to
	// "zone" "Z2" in the "region" "R1" if that is not possible. If that
	// is not possible, the SP may choose between either the "zone"
	// "Z3" or "Z5" in the "region" "R1".
	//
	// Example 3:
	// Given a volume should be accessible from TWO zones (because an
	// opaque parameter in CreateVolumeRequest, for example, specifies
	// the volume is accessible from two zones, aka synchronously
	// replicated), and
	// requisite =
	//   {"region": "R1", "zone": "Z2"},
	//   {"region": "R1", "zone": "Z3"},
	//   {"region": "R1", "zone": "Z4"},
	//   {"region": "R1", "zone": "Z5"}
	// preferred =
	//   {"region": "R1", "zone": "Z5"},
	//   {"region": "R1", "zone": "Z3"}
	// then the SP SHOULD first attempt to make the provisioned volume
	// accessible from the combination of the two "zones" "Z5" and "Z3" in
	// the "region" "R1". If that's not possible, it should fall back to
	// a combination of "Z5" and other possibilities from the list of
	// requisite. If that's not possible, it should fall back  to a
	// combination of "Z3" and other possibilities from the list of
	// requisite. If that's not possible, it should fall back  to a
	// combination of other possibilities from the list of requisite.
	Preferred []Topology `json:",omitempty"`
}

// Topology is a map of topological domains to topological segments.
//
// This description is taken verbatim from the CSI Spec:
//
// A topological domain is a sub-division of a cluster, like "region",
// "zone", "rack", etc.
// A topological segment is a specific instance of a topological domain,
// like "zone3", "rack3", etc.
// For example {"com.company/zone": "Z1", "com.company/rack": "R3"}
// Valid keys have two segments: an OPTIONAL prefix and name, separated
// by a slash (/), for example: "com.company.example/zone".
// The key name segment is REQUIRED. The prefix is OPTIONAL.
// The key name MUST be 63 characters or less, begin and end with an
// alphanumeric character ([a-z0-9A-Z]), and contain only dashes (-),
// underscores (_), dots (.), or alphanumerics in between, for example
// "zone".
// The key prefix MUST be 63 characters or less, begin and end with a
// lower-case alphanumeric character ([a-z0-9]), contain only
// dashes (-), dots (.), or lower-case alphanumerics in between, and
// follow domain name notation format
// (https://tools.ietf.org/html/rfc1035#section-2.3.1).
// The key prefix SHOULD include the plugin's host company name and/or
// the plugin name, to minimize the possibility of collisions with keys
// from other plugins.
// If a key prefix is specified, it MUST be identical across all
// topology keys returned by the SP (across all RPCs).
// Keys MUST be case-insensitive. Meaning the keys "Zone" and "zone"
// MUST not both exist.
// Each value (topological segment) MUST contain 1 or more strings.
// Each string MUST be 63 characters or less and begin and end with an
// alphanumeric character with '-', '_', '.', or alphanumerics in
// between.
type Topology struct {
	Segments map[string]string `json:",omitempty"`
}

// CapacityRange describes the minimum and maximum capacity a volume should be
// created with
type CapacityRange struct {
	// RequiredBytes specifies that a volume must be at least this big. The
	// value of 0 indicates an unspecified minimum.
	RequiredBytes int64

	// LimitBytes specifies that a volume must not be bigger than this. The
	// value of 0 indicates an unspecified maximum
	LimitBytes int64
}

// Secret represents a Swarm Secret value that must be passed to the CSI
// storage plugin when operating on this Volume. It represents one key-value
// pair of possibly many.
type Secret struct {
	// Key is the name of the key of the key-value pair passed to the plugin.
	Key string

	// Secret is the swarm Secret object from which to read data. This can be a
	// Secret name or ID. The Secret data is retrieved by Swarm and used as the
	// value of the key-value pair passed to the plugin.
	Secret string
}

// PublishState represents the state of a Volume as it pertains to its
// use on a particular Node.
type PublishState string

const (
	// StatePending indicates that the volume should be published on
	// this node, but the call to ControllerPublishVolume has not been
	// successfully completed yet and the result recorded by swarmkit.
	StatePending PublishState = "pending-publish"

	// StatePublished means the volume is published successfully to the node.
	StatePublished PublishState = "published"

	// StatePendingNodeUnpublish indicates that the Volume should be
	// unpublished on the Node, and we're waiting for confirmation that it has
	// done so.  After the Node has confirmed that the Volume has been
	// unpublished, the state will move to StatePendingUnpublish.
	StatePendingNodeUnpublish PublishState = "pending-node-unpublish"

	// StatePendingUnpublish means the volume is still published to the node
	// by the controller, awaiting the operation to unpublish it.
	StatePendingUnpublish PublishState = "pending-controller-unpublish"
)

// PublishStatus represents the status of the volume as published to an
// individual node
type PublishStatus struct {
	// NodeID is the ID of the swarm node this Volume is published to.
	NodeID string `json:",omitempty"`

	// State is the publish state of the volume.
	State PublishState `json:",omitempty"`

	// PublishContext is the PublishContext returned by the CSI plugin when
	// a volume is published.
	PublishContext map[string]string `json:",omitempty"`
}

// Info contains information about the Volume as a whole as provided by
// the CSI storage plugin.
type Info struct {
	// CapacityBytes is the capacity of the volume in bytes. A value of 0
	// indicates that the capacity is unknown.
	CapacityBytes int64 `json:",omitempty"`

	// VolumeContext is the context originating from the CSI storage plugin
	// when the Volume is created.
	VolumeContext map[string]string `json:",omitempty"`

	// VolumeID is the ID of the Volume as seen by the CSI storage plugin. This
	// is distinct from the Volume's Swarm ID, which is the ID used by all of
	// the Docker Engine to refer to the Volume. If this field is blank, then
	// the Volume has not been successfully created yet.
	VolumeID string `json:",omitempty"`

	// AccessibleTopology is the topology this volume is actually accessible
	// from.
	AccessibleTopology []Topology `json:",omitempty"`
}
