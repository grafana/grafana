package mount // import "github.com/docker/docker/api/types/mount"

import (
	"os"
)

// Type represents the type of a mount.
type Type string

// Type constants
const (
	// TypeBind is the type for mounting host dir
	TypeBind Type = "bind"
	// TypeVolume is the type for remote storage volumes
	TypeVolume Type = "volume"
	// TypeTmpfs is the type for mounting tmpfs
	TypeTmpfs Type = "tmpfs"
	// TypeNamedPipe is the type for mounting Windows named pipes
	TypeNamedPipe Type = "npipe"
	// TypeCluster is the type for Swarm Cluster Volumes.
	TypeCluster Type = "cluster"
	// TypeImage is the type for mounting another image's filesystem
	TypeImage Type = "image"
)

// Mount represents a mount (volume).
type Mount struct {
	Type Type `json:",omitempty"`
	// Source specifies the name of the mount. Depending on mount type, this
	// may be a volume name or a host path, or even ignored.
	// Source is not supported for tmpfs (must be an empty value)
	Source      string      `json:",omitempty"`
	Target      string      `json:",omitempty"`
	ReadOnly    bool        `json:",omitempty"` // attempts recursive read-only if possible
	Consistency Consistency `json:",omitempty"`

	BindOptions    *BindOptions    `json:",omitempty"`
	VolumeOptions  *VolumeOptions  `json:",omitempty"`
	ImageOptions   *ImageOptions   `json:",omitempty"`
	TmpfsOptions   *TmpfsOptions   `json:",omitempty"`
	ClusterOptions *ClusterOptions `json:",omitempty"`
}

// Propagation represents the propagation of a mount.
type Propagation string

const (
	// PropagationRPrivate RPRIVATE
	PropagationRPrivate Propagation = "rprivate"
	// PropagationPrivate PRIVATE
	PropagationPrivate Propagation = "private"
	// PropagationRShared RSHARED
	PropagationRShared Propagation = "rshared"
	// PropagationShared SHARED
	PropagationShared Propagation = "shared"
	// PropagationRSlave RSLAVE
	PropagationRSlave Propagation = "rslave"
	// PropagationSlave SLAVE
	PropagationSlave Propagation = "slave"
)

// Propagations is the list of all valid mount propagations
var Propagations = []Propagation{
	PropagationRPrivate,
	PropagationPrivate,
	PropagationRShared,
	PropagationShared,
	PropagationRSlave,
	PropagationSlave,
}

// Consistency represents the consistency requirements of a mount.
type Consistency string

const (
	// ConsistencyFull guarantees bind mount-like consistency
	ConsistencyFull Consistency = "consistent"
	// ConsistencyCached mounts can cache read data and FS structure
	ConsistencyCached Consistency = "cached"
	// ConsistencyDelegated mounts can cache read and written data and structure
	ConsistencyDelegated Consistency = "delegated"
	// ConsistencyDefault provides "consistent" behavior unless overridden
	ConsistencyDefault Consistency = "default"
)

// BindOptions defines options specific to mounts of type "bind".
type BindOptions struct {
	Propagation      Propagation `json:",omitempty"`
	NonRecursive     bool        `json:",omitempty"`
	CreateMountpoint bool        `json:",omitempty"`
	// ReadOnlyNonRecursive makes the mount non-recursively read-only, but still leaves the mount recursive
	// (unless NonRecursive is set to true in conjunction).
	ReadOnlyNonRecursive bool `json:",omitempty"`
	// ReadOnlyForceRecursive raises an error if the mount cannot be made recursively read-only.
	ReadOnlyForceRecursive bool `json:",omitempty"`
}

// VolumeOptions represents the options for a mount of type volume.
type VolumeOptions struct {
	NoCopy       bool              `json:",omitempty"`
	Labels       map[string]string `json:",omitempty"`
	Subpath      string            `json:",omitempty"`
	DriverConfig *Driver           `json:",omitempty"`
}

type ImageOptions struct {
	Subpath string `json:",omitempty"`
}

// Driver represents a volume driver.
type Driver struct {
	Name    string            `json:",omitempty"`
	Options map[string]string `json:",omitempty"`
}

// TmpfsOptions defines options specific to mounts of type "tmpfs".
type TmpfsOptions struct {
	// Size sets the size of the tmpfs, in bytes.
	//
	// This will be converted to an operating system specific value
	// depending on the host. For example, on linux, it will be converted to
	// use a 'k', 'm' or 'g' syntax. BSD, though not widely supported with
	// docker, uses a straight byte value.
	//
	// Percentages are not supported.
	SizeBytes int64 `json:",omitempty"`
	// Mode of the tmpfs upon creation
	Mode os.FileMode `json:",omitempty"`
	// Options to be passed to the tmpfs mount. An array of arrays. Flag
	// options should be provided as 1-length arrays. Other types should be
	// provided as 2-length arrays, where the first item is the key and the
	// second the value.
	Options [][]string `json:",omitempty"`
	// TODO(stevvooe): There are several more tmpfs flags, specified in the
	// daemon, that are accepted. Only the most basic are added for now.
	//
	// From https://github.com/moby/sys/blob/mount/v0.1.1/mount/flags.go#L47-L56
	//
	// var validFlags = map[string]bool{
	// 	"":          true,
	// 	"size":      true, X
	// 	"mode":      true, X
	// 	"uid":       true,
	// 	"gid":       true,
	// 	"nr_inodes": true,
	// 	"nr_blocks": true,
	// 	"mpol":      true,
	// }
	//
	// Some of these may be straightforward to add, but others, such as
	// uid/gid have implications in a clustered system.
}

// ClusterOptions specifies options for a Cluster volume.
type ClusterOptions struct {
	// intentionally empty
}
