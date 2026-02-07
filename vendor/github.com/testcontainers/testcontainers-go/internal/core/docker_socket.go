package core

import (
	"net/url"
	"strings"

	"github.com/docker/docker/client"
)

// DockerSocketSchema is the unix schema.
var DockerSocketSchema = "unix://"

// DockerSocketPath is the path to the docker socket under unix systems.
var DockerSocketPath = "/var/run/docker.sock"

// DockerSocketPathWithSchema is the path to the docker socket under unix systems with the unix schema.
var DockerSocketPathWithSchema = DockerSocketSchema + DockerSocketPath

// TCPSchema is the tcp schema.
var TCPSchema = "tcp://"

// WindowsDockerSocketPath is the path to the docker socket under windows systems.
var WindowsDockerSocketPath = "//var/run/docker.sock"

func init() {
	const DefaultDockerHost = client.DefaultDockerHost

	u, err := url.Parse(DefaultDockerHost)
	if err != nil {
		// unsupported default host specified by the docker client package,
		// so revert to the default unix docker socket path
		return
	}

	switch u.Scheme {
	case "unix", "npipe":
		DockerSocketSchema = u.Scheme + "://"
		DockerSocketPath = u.Path
		if !strings.HasPrefix(DockerSocketPath, "/") {
			// seeing as the code in this module depends on DockerSocketPath having
			// a slash (`/`) prefix, we add it here if it is missing.
			// for the known environments, we do not foresee how the socket-path
			// should miss the slash, however this extra if-condition is worth to
			// save future pain from innocent users.
			DockerSocketPath = "/" + DockerSocketPath
		}
		DockerSocketPathWithSchema = DockerSocketSchema + DockerSocketPath
	}
}
