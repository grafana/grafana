package container

import (
	"io"
	"os"
	"time"

	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/storage"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

// ContainerUpdateOKBody OK response to ContainerUpdate operation
//
// Deprecated: use [UpdateResponse]. This alias will be removed in the next release.
type ContainerUpdateOKBody = UpdateResponse

// ContainerTopOKBody OK response to ContainerTop operation
//
// Deprecated: use [TopResponse]. This alias will be removed in the next release.
type ContainerTopOKBody = TopResponse

// PruneReport contains the response for Engine API:
// POST "/containers/prune"
type PruneReport struct {
	ContainersDeleted []string
	SpaceReclaimed    uint64
}

// PathStat is used to encode the header from
// GET "/containers/{name:.*}/archive"
// "Name" is the file or directory name.
type PathStat struct {
	Name       string      `json:"name"`
	Size       int64       `json:"size"`
	Mode       os.FileMode `json:"mode"`
	Mtime      time.Time   `json:"mtime"`
	LinkTarget string      `json:"linkTarget"`
}

// CopyToContainerOptions holds information
// about files to copy into a container
type CopyToContainerOptions struct {
	AllowOverwriteDirWithFile bool
	CopyUIDGID                bool
}

// StatsResponseReader wraps an io.ReadCloser to read (a stream of) stats
// for a container, as produced by the GET "/stats" endpoint.
//
// The OSType field is set to the server's platform to allow
// platform-specific handling of the response.
//
// TODO(thaJeztah): remove this wrapper, and make OSType part of [StatsResponse].
type StatsResponseReader struct {
	Body   io.ReadCloser `json:"body"`
	OSType string        `json:"ostype"`
}

// MountPoint represents a mount point configuration inside the container.
// This is used for reporting the mountpoints in use by a container.
type MountPoint struct {
	// Type is the type of mount, see `Type<foo>` definitions in
	// github.com/docker/docker/api/types/mount.Type
	Type mount.Type `json:",omitempty"`

	// Name is the name reference to the underlying data defined by `Source`
	// e.g., the volume name.
	Name string `json:",omitempty"`

	// Source is the source location of the mount.
	//
	// For volumes, this contains the storage location of the volume (within
	// `/var/lib/docker/volumes/`). For bind-mounts, and `npipe`, this contains
	// the source (host) part of the bind-mount. For `tmpfs` mount points, this
	// field is empty.
	Source string

	// Destination is the path relative to the container root (`/`) where the
	// Source is mounted inside the container.
	Destination string

	// Driver is the volume driver used to create the volume (if it is a volume).
	Driver string `json:",omitempty"`

	// Mode is a comma separated list of options supplied by the user when
	// creating the bind/volume mount.
	//
	// The default is platform-specific (`"z"` on Linux, empty on Windows).
	Mode string

	// RW indicates whether the mount is mounted writable (read-write).
	RW bool

	// Propagation describes how mounts are propagated from the host into the
	// mount point, and vice-versa. Refer to the Linux kernel documentation
	// for details:
	// https://www.kernel.org/doc/Documentation/filesystems/sharedsubtree.txt
	//
	// This field is not used on Windows.
	Propagation mount.Propagation
}

// State stores container's running state
// it's part of ContainerJSONBase and returned by "inspect" command
type State struct {
	Status     string // String representation of the container state. Can be one of "created", "running", "paused", "restarting", "removing", "exited", or "dead"
	Running    bool
	Paused     bool
	Restarting bool
	OOMKilled  bool
	Dead       bool
	Pid        int
	ExitCode   int
	Error      string
	StartedAt  string
	FinishedAt string
	Health     *Health `json:",omitempty"`
}

// Summary contains response of Engine API:
// GET "/containers/json"
type Summary struct {
	ID                      string `json:"Id"`
	Names                   []string
	Image                   string
	ImageID                 string
	ImageManifestDescriptor *ocispec.Descriptor `json:"ImageManifestDescriptor,omitempty"`
	Command                 string
	Created                 int64
	Ports                   []Port
	SizeRw                  int64 `json:",omitempty"`
	SizeRootFs              int64 `json:",omitempty"`
	Labels                  map[string]string
	State                   string
	Status                  string
	HostConfig              struct {
		NetworkMode string            `json:",omitempty"`
		Annotations map[string]string `json:",omitempty"`
	}
	NetworkSettings *NetworkSettingsSummary
	Mounts          []MountPoint
}

// ContainerJSONBase contains response of Engine API GET "/containers/{name:.*}/json"
// for API version 1.18 and older.
//
// TODO(thaJeztah): combine ContainerJSONBase and InspectResponse into a single struct.
// The split between ContainerJSONBase (ContainerJSONBase) and InspectResponse (InspectResponse)
// was done in commit 6deaa58ba5f051039643cedceee97c8695e2af74 (https://github.com/moby/moby/pull/13675).
// ContainerJSONBase contained all fields for API < 1.19, and InspectResponse
// held fields that were added in API 1.19 and up. Given that the minimum
// supported API version is now 1.24, we no longer use the separate type.
type ContainerJSONBase struct {
	ID              string `json:"Id"`
	Created         string
	Path            string
	Args            []string
	State           *State
	Image           string
	ResolvConfPath  string
	HostnamePath    string
	HostsPath       string
	LogPath         string
	Name            string
	RestartCount    int
	Driver          string
	Platform        string
	MountLabel      string
	ProcessLabel    string
	AppArmorProfile string
	ExecIDs         []string
	HostConfig      *HostConfig
	GraphDriver     storage.DriverData
	SizeRw          *int64 `json:",omitempty"`
	SizeRootFs      *int64 `json:",omitempty"`
}

// InspectResponse is the response for the GET "/containers/{name:.*}/json"
// endpoint.
type InspectResponse struct {
	*ContainerJSONBase
	Mounts          []MountPoint
	Config          *Config
	NetworkSettings *NetworkSettings
	// ImageManifestDescriptor is the descriptor of a platform-specific manifest of the image used to create the container.
	ImageManifestDescriptor *ocispec.Descriptor `json:"ImageManifestDescriptor,omitempty"`
}
