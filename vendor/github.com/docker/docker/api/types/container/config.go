package container // import "github.com/docker/docker/api/types/container"

import (
	"time"

	"github.com/docker/docker/api/types/strslice"
	"github.com/docker/go-connections/nat"
	dockerspec "github.com/moby/docker-image-spec/specs-go/v1"
)

// MinimumDuration puts a minimum on user configured duration.
// This is to prevent API error on time unit. For example, API may
// set 3 as healthcheck interval with intention of 3 seconds, but
// Docker interprets it as 3 nanoseconds.
const MinimumDuration = 1 * time.Millisecond

// StopOptions holds the options to stop or restart a container.
type StopOptions struct {
	// Signal (optional) is the signal to send to the container to (gracefully)
	// stop it before forcibly terminating the container with SIGKILL after the
	// timeout expires. If not value is set, the default (SIGTERM) is used.
	Signal string `json:",omitempty"`

	// Timeout (optional) is the timeout (in seconds) to wait for the container
	// to stop gracefully before forcibly terminating it with SIGKILL.
	//
	// - Use nil to use the default timeout (10 seconds).
	// - Use '-1' to wait indefinitely.
	// - Use '0' to not wait for the container to exit gracefully, and
	//   immediately proceeds to forcibly terminating the container.
	// - Other positive values are used as timeout (in seconds).
	Timeout *int `json:",omitempty"`
}

// HealthConfig holds configuration settings for the HEALTHCHECK feature.
type HealthConfig = dockerspec.HealthcheckConfig

// Config contains the configuration data about a container.
// It should hold only portable information about the container.
// Here, "portable" means "independent from the host we are running on".
// Non-portable information *should* appear in HostConfig.
// All fields added to this struct must be marked `omitempty` to keep getting
// predictable hashes from the old `v1Compatibility` configuration.
type Config struct {
	Hostname        string              // Hostname
	Domainname      string              // Domainname
	User            string              // User that will run the command(s) inside the container, also support user:group
	AttachStdin     bool                // Attach the standard input, makes possible user interaction
	AttachStdout    bool                // Attach the standard output
	AttachStderr    bool                // Attach the standard error
	ExposedPorts    nat.PortSet         `json:",omitempty"` // List of exposed ports
	Tty             bool                // Attach standard streams to a tty, including stdin if it is not closed.
	OpenStdin       bool                // Open stdin
	StdinOnce       bool                // If true, close stdin after the 1 attached client disconnects.
	Env             []string            // List of environment variable to set in the container
	Cmd             strslice.StrSlice   // Command to run when starting the container
	Healthcheck     *HealthConfig       `json:",omitempty"` // Healthcheck describes how to check the container is healthy
	ArgsEscaped     bool                `json:",omitempty"` // True if command is already escaped (meaning treat as a command line) (Windows specific).
	Image           string              // Name of the image as it was passed by the operator (e.g. could be symbolic)
	Volumes         map[string]struct{} // List of volumes (mounts) used for the container
	WorkingDir      string              // Current directory (PWD) in the command will be launched
	Entrypoint      strslice.StrSlice   // Entrypoint to run when starting the container
	NetworkDisabled bool                `json:",omitempty"` // Is network disabled
	// Mac Address of the container.
	//
	// Deprecated: this field is deprecated since API v1.44. Use EndpointSettings.MacAddress instead.
	MacAddress  string            `json:",omitempty"`
	OnBuild     []string          // ONBUILD metadata that were defined on the image Dockerfile
	Labels      map[string]string // List of labels set to this container
	StopSignal  string            `json:",omitempty"` // Signal to stop a container
	StopTimeout *int              `json:",omitempty"` // Timeout (in seconds) to stop a container
	Shell       strslice.StrSlice `json:",omitempty"` // Shell for shell-form of RUN, CMD, ENTRYPOINT
}
