package v1

import (
	"time"

	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

const DockerOCIImageMediaType = "application/vnd.docker.container.image.v1+json"

// DockerOCIImage is a ocispec.Image extended with Docker specific Config.
type DockerOCIImage struct {
	ocispec.Image

	// Shadow ocispec.Image.Config
	Config DockerOCIImageConfig `json:"config,omitempty"`
}

// DockerOCIImageConfig is a ocispec.ImageConfig extended with Docker specific fields.
type DockerOCIImageConfig struct {
	ocispec.ImageConfig

	DockerOCIImageConfigExt
}

// DockerOCIImageConfigExt contains Docker-specific fields in DockerImageConfig.
type DockerOCIImageConfigExt struct {
	Healthcheck *HealthcheckConfig `json:",omitempty"` // Healthcheck describes how to check the container is healthy

	OnBuild []string `json:",omitempty"` // ONBUILD metadata that were defined on the image Dockerfile
	Shell   []string `json:",omitempty"` // Shell for shell-form of RUN, CMD, ENTRYPOINT
}

// HealthcheckConfig holds configuration settings for the HEALTHCHECK feature.
type HealthcheckConfig struct {
	// Test is the test to perform to check that the container is healthy.
	// An empty slice means to inherit the default.
	// The options are:
	// {} : inherit healthcheck
	// {"NONE"} : disable healthcheck
	// {"CMD", args...} : exec arguments directly
	// {"CMD-SHELL", command} : run command with system's default shell
	Test []string `json:",omitempty"`

	// Zero means to inherit. Durations are expressed as integer nanoseconds.
	Interval      time.Duration `json:",omitempty"` // Interval is the time to wait between checks.
	Timeout       time.Duration `json:",omitempty"` // Timeout is the time to wait before considering the check to have hung.
	StartPeriod   time.Duration `json:",omitempty"` // The start period for the container to initialize before the retries starts to count down.
	StartInterval time.Duration `json:",omitempty"` // The interval to attempt healthchecks at during the start period

	// Retries is the number of consecutive failures needed to consider a container as unhealthy.
	// Zero means inherit.
	Retries int `json:",omitempty"`
}
