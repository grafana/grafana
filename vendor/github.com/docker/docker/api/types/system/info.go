package system

import (
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/api/types/swarm"
)

// Info contains response of Engine API:
// GET "/info"
type Info struct {
	ID                 string
	Containers         int
	ContainersRunning  int
	ContainersPaused   int
	ContainersStopped  int
	Images             int
	Driver             string
	DriverStatus       [][2]string
	SystemStatus       [][2]string `json:",omitempty"` // SystemStatus is only propagated by the Swarm standalone API
	Plugins            PluginsInfo
	MemoryLimit        bool
	SwapLimit          bool
	KernelMemory       bool `json:",omitempty"` // Deprecated: kernel 5.4 deprecated kmem.limit_in_bytes
	KernelMemoryTCP    bool `json:",omitempty"` // KernelMemoryTCP is not supported on cgroups v2.
	CPUCfsPeriod       bool `json:"CpuCfsPeriod"`
	CPUCfsQuota        bool `json:"CpuCfsQuota"`
	CPUShares          bool
	CPUSet             bool
	PidsLimit          bool
	IPv4Forwarding     bool
	BridgeNfIptables   bool `json:"BridgeNfIptables"`  // Deprecated: netfilter module is now loaded on-demand and no longer during daemon startup, making this field obsolete. This field is always false and will be removed in the next release.
	BridgeNfIP6tables  bool `json:"BridgeNfIp6tables"` // Deprecated: netfilter module is now loaded on-demand and no longer during daemon startup, making this field obsolete. This field is always false and will be removed in the next release.
	Debug              bool
	NFd                int
	OomKillDisable     bool
	NGoroutines        int
	SystemTime         string
	LoggingDriver      string
	CgroupDriver       string
	CgroupVersion      string `json:",omitempty"`
	NEventsListener    int
	KernelVersion      string
	OperatingSystem    string
	OSVersion          string
	OSType             string
	Architecture       string
	IndexServerAddress string
	RegistryConfig     *registry.ServiceConfig
	NCPU               int
	MemTotal           int64
	GenericResources   []swarm.GenericResource
	DockerRootDir      string
	HTTPProxy          string `json:"HttpProxy"`
	HTTPSProxy         string `json:"HttpsProxy"`
	NoProxy            string
	Name               string
	Labels             []string
	ExperimentalBuild  bool
	ServerVersion      string
	Runtimes           map[string]RuntimeWithStatus
	DefaultRuntime     string
	Swarm              swarm.Info
	// LiveRestoreEnabled determines whether containers should be kept
	// running when the daemon is shutdown or upon daemon start if
	// running containers are detected
	LiveRestoreEnabled  bool
	Isolation           container.Isolation
	InitBinary          string
	ContainerdCommit    Commit
	RuncCommit          Commit
	InitCommit          Commit
	SecurityOptions     []string
	ProductLicense      string               `json:",omitempty"`
	DefaultAddressPools []NetworkAddressPool `json:",omitempty"`
	CDISpecDirs         []string

	Containerd *ContainerdInfo `json:",omitempty"`

	// Warnings contains a slice of warnings that occurred  while collecting
	// system information. These warnings are intended to be informational
	// messages for the user, and are not intended to be parsed / used for
	// other purposes, as they do not have a fixed format.
	Warnings []string
}

// ContainerdInfo holds information about the containerd instance used by the daemon.
type ContainerdInfo struct {
	// Address is the path to the containerd socket.
	Address string `json:",omitempty"`
	// Namespaces is the containerd namespaces used by the daemon.
	Namespaces ContainerdNamespaces
}

// ContainerdNamespaces reflects the containerd namespaces used by the daemon.
//
// These namespaces can be configured in the daemon configuration, and are
// considered to be used exclusively by the daemon,
//
// As these namespaces are considered to be exclusively accessed
// by the daemon, it is not recommended to change these values,
// or to change them to a value that is used by other systems,
// such as cri-containerd.
type ContainerdNamespaces struct {
	// Containers holds the default containerd namespace used for
	// containers managed by the daemon.
	//
	// The default namespace for containers is "moby", but will be
	// suffixed with the `<uid>.<gid>` of the remapped `root` if
	// user-namespaces are enabled and the containerd image-store
	// is used.
	Containers string

	// Plugins holds the default containerd namespace used for
	// plugins managed by the daemon.
	//
	// The default namespace for plugins is "moby", but will be
	// suffixed with the `<uid>.<gid>` of the remapped `root` if
	// user-namespaces are enabled and the containerd image-store
	// is used.
	Plugins string
}

// PluginsInfo is a temp struct holding Plugins name
// registered with docker daemon. It is used by [Info] struct
type PluginsInfo struct {
	// List of Volume plugins registered
	Volume []string
	// List of Network plugins registered
	Network []string
	// List of Authorization plugins registered
	Authorization []string
	// List of Log plugins registered
	Log []string
}

// Commit holds the Git-commit (SHA1) that a binary was built from, as reported
// in the version-string of external tools, such as containerd, or runC.
type Commit struct {
	// ID is the actual commit ID or version of external tool.
	ID string

	// Expected is the commit ID of external tool expected by dockerd as set at build time.
	//
	// Deprecated: this field is no longer used in API v1.49, but kept for backward-compatibility with older API versions.
	Expected string
}

// NetworkAddressPool is a temp struct used by [Info] struct.
type NetworkAddressPool struct {
	Base string
	Size int
}
