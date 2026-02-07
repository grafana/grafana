package types // import "github.com/docker/docker/api/types"

import (
	"bufio"
	"context"
	"io"
	"net"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/registry"
)

// NewHijackedResponse initializes a [HijackedResponse] type.
func NewHijackedResponse(conn net.Conn, mediaType string) HijackedResponse {
	return HijackedResponse{Conn: conn, Reader: bufio.NewReader(conn), mediaType: mediaType}
}

// HijackedResponse holds connection information for a hijacked request.
type HijackedResponse struct {
	mediaType string
	Conn      net.Conn
	Reader    *bufio.Reader
}

// Close closes the hijacked connection and reader.
func (h *HijackedResponse) Close() {
	h.Conn.Close()
}

// MediaType let client know if HijackedResponse hold a raw or multiplexed stream.
// returns false if HTTP Content-Type is not relevant, and container must be inspected
func (h *HijackedResponse) MediaType() (string, bool) {
	if h.mediaType == "" {
		return "", false
	}
	return h.mediaType, true
}

// CloseWriter is an interface that implements structs
// that close input streams to prevent from writing.
type CloseWriter interface {
	CloseWrite() error
}

// CloseWrite closes a readWriter for writing.
func (h *HijackedResponse) CloseWrite() error {
	if conn, ok := h.Conn.(CloseWriter); ok {
		return conn.CloseWrite()
	}
	return nil
}

// ImageBuildOptions holds the information
// necessary to build images.
type ImageBuildOptions struct {
	Tags           []string
	SuppressOutput bool
	RemoteContext  string
	NoCache        bool
	Remove         bool
	ForceRemove    bool
	PullParent     bool
	Isolation      container.Isolation
	CPUSetCPUs     string
	CPUSetMems     string
	CPUShares      int64
	CPUQuota       int64
	CPUPeriod      int64
	Memory         int64
	MemorySwap     int64
	CgroupParent   string
	NetworkMode    string
	ShmSize        int64
	Dockerfile     string
	Ulimits        []*container.Ulimit
	// BuildArgs needs to be a *string instead of just a string so that
	// we can tell the difference between "" (empty string) and no value
	// at all (nil). See the parsing of buildArgs in
	// api/server/router/build/build_routes.go for even more info.
	BuildArgs   map[string]*string
	AuthConfigs map[string]registry.AuthConfig
	Context     io.Reader
	Labels      map[string]string
	// squash the resulting image's layers to the parent
	// preserves the original image and creates a new one from the parent with all
	// the changes applied to a single layer
	Squash bool
	// CacheFrom specifies images that are used for matching cache. Images
	// specified here do not need to have a valid parent chain to match cache.
	CacheFrom   []string
	SecurityOpt []string
	ExtraHosts  []string // List of extra hosts
	Target      string
	SessionID   string
	Platform    string
	// Version specifies the version of the underlying builder to use
	Version BuilderVersion
	// BuildID is an optional identifier that can be passed together with the
	// build request. The same identifier can be used to gracefully cancel the
	// build with the cancel request.
	BuildID string
	// Outputs defines configurations for exporting build results. Only supported
	// in BuildKit mode
	Outputs []ImageBuildOutput
}

// ImageBuildOutput defines configuration for exporting a build result
type ImageBuildOutput struct {
	Type  string
	Attrs map[string]string
}

// BuilderVersion sets the version of underlying builder to use
type BuilderVersion string

const (
	// BuilderV1 is the first generation builder in docker daemon
	BuilderV1 BuilderVersion = "1"
	// BuilderBuildKit is builder based on moby/buildkit project
	BuilderBuildKit BuilderVersion = "2"
)

// ImageBuildResponse holds information
// returned by a server after building
// an image.
type ImageBuildResponse struct {
	Body   io.ReadCloser
	OSType string
}

// NodeListOptions holds parameters to list nodes with.
type NodeListOptions struct {
	Filters filters.Args
}

// NodeRemoveOptions holds parameters to remove nodes with.
type NodeRemoveOptions struct {
	Force bool
}

// ServiceCreateOptions contains the options to use when creating a service.
type ServiceCreateOptions struct {
	// EncodedRegistryAuth is the encoded registry authorization credentials to
	// use when updating the service.
	//
	// This field follows the format of the X-Registry-Auth header.
	EncodedRegistryAuth string

	// QueryRegistry indicates whether the service update requires
	// contacting a registry. A registry may be contacted to retrieve
	// the image digest and manifest, which in turn can be used to update
	// platform or other information about the service.
	QueryRegistry bool
}

// Values for RegistryAuthFrom in ServiceUpdateOptions
const (
	RegistryAuthFromSpec         = "spec"
	RegistryAuthFromPreviousSpec = "previous-spec"
)

// ServiceUpdateOptions contains the options to be used for updating services.
type ServiceUpdateOptions struct {
	// EncodedRegistryAuth is the encoded registry authorization credentials to
	// use when updating the service.
	//
	// This field follows the format of the X-Registry-Auth header.
	EncodedRegistryAuth string

	// TODO(stevvooe): Consider moving the version parameter of ServiceUpdate
	// into this field. While it does open API users up to racy writes, most
	// users may not need that level of consistency in practice.

	// RegistryAuthFrom specifies where to find the registry authorization
	// credentials if they are not given in EncodedRegistryAuth. Valid
	// values are "spec" and "previous-spec".
	RegistryAuthFrom string

	// Rollback indicates whether a server-side rollback should be
	// performed. When this is set, the provided spec will be ignored.
	// The valid values are "previous" and "none". An empty value is the
	// same as "none".
	Rollback string

	// QueryRegistry indicates whether the service update requires
	// contacting a registry. A registry may be contacted to retrieve
	// the image digest and manifest, which in turn can be used to update
	// platform or other information about the service.
	QueryRegistry bool
}

// ServiceListOptions holds parameters to list services with.
type ServiceListOptions struct {
	Filters filters.Args

	// Status indicates whether the server should include the service task
	// count of running and desired tasks.
	Status bool
}

// ServiceInspectOptions holds parameters related to the "service inspect"
// operation.
type ServiceInspectOptions struct {
	InsertDefaults bool
}

// TaskListOptions holds parameters to list tasks with.
type TaskListOptions struct {
	Filters filters.Args
}

// PluginRemoveOptions holds parameters to remove plugins.
type PluginRemoveOptions struct {
	Force bool
}

// PluginEnableOptions holds parameters to enable plugins.
type PluginEnableOptions struct {
	Timeout int
}

// PluginDisableOptions holds parameters to disable plugins.
type PluginDisableOptions struct {
	Force bool
}

// PluginInstallOptions holds parameters to install a plugin.
type PluginInstallOptions struct {
	Disabled             bool
	AcceptAllPermissions bool
	RegistryAuth         string // RegistryAuth is the base64 encoded credentials for the registry
	RemoteRef            string // RemoteRef is the plugin name on the registry

	// PrivilegeFunc is a function that clients can supply to retry operations
	// after getting an authorization error. This function returns the registry
	// authentication header value in base64 encoded format, or an error if the
	// privilege request fails.
	//
	// For details, refer to [github.com/docker/docker/api/types/registry.RequestAuthConfig].
	PrivilegeFunc         func(context.Context) (string, error)
	AcceptPermissionsFunc func(context.Context, PluginPrivileges) (bool, error)
	Args                  []string
}

// SwarmUnlockKeyResponse contains the response for Engine API:
// GET /swarm/unlockkey
type SwarmUnlockKeyResponse struct {
	// UnlockKey is the unlock key in ASCII-armored format.
	UnlockKey string
}

// PluginCreateOptions hold all options to plugin create.
type PluginCreateOptions struct {
	RepoName string
}
