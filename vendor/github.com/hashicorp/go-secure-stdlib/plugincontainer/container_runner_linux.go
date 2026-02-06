// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugincontainer

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"github.com/hashicorp/go-plugin/runner"
	"github.com/joshlf/go-acl"
)

const pluginSocketDir = "/tmp/go-plugin-container"

var _ runner.Runner = (*containerRunner)(nil)

// containerRunner implements go-plugin's runner.Runner interface to run plugins
// inside a container.
type containerRunner struct {
	logger hclog.Logger

	hostSocketDir string

	containerConfig *container.Config
	hostConfig      *container.HostConfig
	networkConfig   *network.NetworkingConfig

	dockerClient *client.Client
	stdout       io.ReadCloser
	stderr       io.ReadCloser

	image  string
	tag    string
	sha256 string
	id     string
	debug  bool
}

// NewContainerRunner must be passed a cmd that hasn't yet been started.
func (cfg *Config) NewContainerRunner(logger hclog.Logger, cmd *exec.Cmd, hostSocketDir string) (runner.Runner, error) {
	if cfg.Image == "" {
		return nil, errors.New("must provide an image")
	}

	if strings.Contains(cfg.Image, ":") {
		return nil, fmt.Errorf("image %q must not have any ':' characters, use the Tag field to specify a tag", cfg.Image)
	}

	client, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	// Accept both "abc123..." and "sha256:abc123...", but treat the former as
	// the canonical form.
	sha256 := strings.TrimPrefix(cfg.SHA256, "sha256:")

	// Default to using the SHA256 for secure pinning of images, but allow users
	// to omit the SHA256 as well.
	var imageRef string
	if sha256 != "" {
		imageRef = "sha256:" + sha256
	} else {
		imageRef = cfg.Image
		if cfg.Tag != "" {
			imageRef += ":" + cfg.Tag
		}
	}
	// Container config.
	containerConfig := &container.Config{
		Image:           imageRef,
		Env:             cmd.Env,
		NetworkDisabled: cfg.DisableNetwork,
		Labels:          cfg.Labels,
	}
	containerConfig.Env = append(containerConfig.Env, fmt.Sprintf("%s=%s", plugin.EnvUnixSocketDir, pluginSocketDir))
	if cfg.Entrypoint != nil {
		containerConfig.Entrypoint = cfg.Entrypoint
	}
	if cfg.Args != nil {
		containerConfig.Cmd = cfg.Args
		containerConfig.ArgsEscaped = true
	}
	if cfg.Env != nil {
		containerConfig.Env = append(containerConfig.Env, cfg.Env...)
	}

	// Host config.
	hostConfig := &container.HostConfig{
		AutoRemove:    !cfg.Debug,                // Plugin containers are ephemeral.
		RestartPolicy: container.RestartPolicy{}, // Empty restart policy means never.
		Runtime:       cfg.Runtime,               // OCI runtime.
		Resources: container.Resources{
			NanoCPUs:     cfg.NanoCpus,     // CPU limit in billionths of a core.
			Memory:       cfg.Memory,       // Memory limit in bytes.
			CgroupParent: cfg.CgroupParent, // Parent Cgroup for the container.
		},
		CapDrop: []string{"ALL"},

		// Bind mount for 2-way Unix socket communication.
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeBind,
				Source:   hostSocketDir,
				Target:   pluginSocketDir,
				ReadOnly: false,
				BindOptions: &mount.BindOptions{
					// Private propagation, we don't need to replicate this mount.
					// For details, see https://docs.docker.com/storage/bind-mounts/#configure-bind-propagation.
					Propagation:  mount.PropagationPrivate,
					NonRecursive: true,
				},
				Consistency: mount.ConsistencyDefault,
			},
		},
	}

	if cfg.GroupAdd != 0 {
		hostConfig.GroupAdd = append(hostConfig.GroupAdd, strconv.Itoa(cfg.GroupAdd))
	}

	if cfg.CapIPCLock {
		hostConfig.CapAdd = append(hostConfig.CapAdd, "IPC_LOCK")
	}
	if cfg.Rootless {
		hostConfig.CapAdd = append(hostConfig.CapAdd, "DAC_OVERRIDE")
		if err := configureDefaultACLsForRootless(hostSocketDir); err != nil {
			return nil, err
		}
	}

	// Network config.
	networkConfig := &network.NetworkingConfig{
		EndpointsConfig: cfg.EndpointsConfig,
	}

	return &containerRunner{
		logger:        logger,
		hostSocketDir: hostSocketDir,
		dockerClient:  client,

		containerConfig: containerConfig,
		hostConfig:      hostConfig,
		networkConfig:   networkConfig,

		image:  cfg.Image,
		tag:    cfg.Tag,
		sha256: sha256,
		debug:  cfg.Debug,
	}, nil
}

func (c *containerRunner) Start(ctx context.Context) error {
	c.logger.Debug("starting container", "image", c.image)

	if c.sha256 != "" {
		ref := c.image
		if c.tag != "" {
			ref += ":" + c.tag
		}
		// Check the Image and SHA256 provided in the config match up.
		images, err := c.dockerClient.ImageList(ctx, image.ListOptions{
			Filters: filters.NewArgs(filters.Arg("reference", ref)),
		})
		if err != nil {
			return fmt.Errorf("failed to verify that image %s matches with provided SHA256 hash %s: %w", ref, c.sha256, err)
		}
		var imageFound bool
		for _, image := range images {
			if image.ID == "sha256:"+c.sha256 {
				imageFound = true
				break
			}
		}
		if !imageFound {
			return fmt.Errorf("could not find any locally available images named %s that match with the provided SHA256 hash %s: %w", ref, c.sha256, ErrSHA256Mismatch)
		}
	}

	resp, err := c.dockerClient.ContainerCreate(ctx, c.containerConfig, c.hostConfig, c.networkConfig, nil, "")
	if err != nil {
		return fmt.Errorf("error creating container: %w", err)
	}
	c.id = resp.ID
	c.logger.Trace("created container", "image", c.image, "id", c.id)

	if err := c.dockerClient.ContainerStart(ctx, c.id, container.StartOptions{}); err != nil {
		return fmt.Errorf("error starting container: %w", err)
	}

	// ContainerLogs combines stdout and stderr.
	// Container logs will stream beyond the lifetime of the initial start
	// context, so we pass it a fresh context with no timeout.
	logReader, err := c.dockerClient.ContainerLogs(context.Background(), c.id, container.LogsOptions{
		Follow:     true,
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return err
	}

	// Split logReader stream into distinct stdout and stderr readers.
	var stdoutWriter, stderrWriter io.WriteCloser
	c.stdout, stdoutWriter = io.Pipe()
	c.stderr, stderrWriter = io.Pipe()
	go func() {
		defer func() {
			c.logger.Trace("container logging goroutine shutting down", "id", c.id)
			logReader.Close()
			stdoutWriter.Close()
			stderrWriter.Close()
		}()

		// StdCopy will run until it receives EOF from logReader
		if _, err := stdcopy.StdCopy(stdoutWriter, stderrWriter, logReader); err != nil {
			c.logger.Error("error streaming logs from container", "id", c.id, "error", err)
		}
	}()

	return nil
}

func (c *containerRunner) Wait(ctx context.Context) error {
	statusCh, errCh := c.dockerClient.ContainerWait(ctx, c.id, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return err
		}
	case st := <-statusCh:
		if st.StatusCode != 0 {
			c.logger.Error("plugin shut down with non-0 exit code", "id", c.id, "status", st.StatusCode)
		}
		if st.Error != nil {
			return errors.New(st.Error.Message)
		}
		return nil
	}

	// unreachable
	return nil
}

func (c *containerRunner) Kill(ctx context.Context) error {
	c.logger.Debug("killing container", "image", c.image, "id", c.id)
	defer c.dockerClient.Close()
	if c.id != "" {
		if c.debug {
			defer func() {
				err := c.dockerClient.ContainerRemove(ctx, c.id, container.RemoveOptions{
					Force: true,
				})
				if err != nil {
					c.logger.Error("error removing container", "error", err)
				}
			}()
		}
		err := c.dockerClient.ContainerStop(ctx, c.id, container.StopOptions{})
		if err != nil {
			// Docker SDK does not seem to expose sentinel errors in a way we can
			// use here instead of string matching.
			if strings.Contains(strings.ToLower(err.Error()), "no such container:") {
				c.logger.Trace("container already stopped", "image", c.image, "id", c.id)
				return nil
			}

			return err
		}
	}

	return nil
}

func (c *containerRunner) Stdout() io.ReadCloser {
	return c.stdout
}

func (c *containerRunner) Stderr() io.ReadCloser {
	return c.stderr
}

func (c *containerRunner) PluginToHost(pluginNet, pluginAddr string) (hostNet string, hostAddr string, err error) {
	if path.Dir(pluginAddr) != pluginSocketDir {
		return "", "", fmt.Errorf("expected address to be in directory %s, but was %s; "+
			"the plugin may need to be recompiled with the latest go-plugin version", pluginSocketDir, pluginAddr)
	}
	return pluginNet, path.Join(c.hostSocketDir, path.Base(pluginAddr)), nil
}

func (c *containerRunner) HostToPlugin(hostNet, hostAddr string) (pluginNet string, pluginAddr string, err error) {
	if path.Dir(hostAddr) != c.hostSocketDir {
		return "", "", fmt.Errorf("expected address to be in directory %s, but was %s", c.hostSocketDir, hostAddr)
	}
	return hostNet, path.Join(pluginSocketDir, path.Base(hostAddr)), nil
}

func (c *containerRunner) Name() string {
	return c.image
}

func (c *containerRunner) ID() string {
	return c.id
}

// Diagnose prints out the container config to help users manually re-run the
// plugin for debugging purposes.
func (c *containerRunner) Diagnose(ctx context.Context) string {
	notes := "Config:\n"
	notes += fmt.Sprintf("Image ref: %s\n", c.containerConfig.Image)
	if !emptyStrSlice(c.containerConfig.Entrypoint) {
		notes += fmt.Sprintf("Entrypoint: %s\n", strings.Join(c.containerConfig.Entrypoint, " "))
	}
	if !emptyStrSlice(c.containerConfig.Cmd) {
		notes += fmt.Sprintf("Cmd: %s\n", c.containerConfig.Cmd)
	}
	if c.hostConfig.Runtime != "" {
		notes += fmt.Sprintf("Runtime: %s\n", c.hostConfig.Runtime)
	}
	notes += fmt.Sprintf("GroupAdd: %v\n", c.hostConfig.GroupAdd)

	if c.debug {
		notes += "Env:\n"
		for _, e := range c.containerConfig.Env {
			notes += e + "\n"
		}

		info := c.diagnoseContainerInfo(ctx)
		if info != "" {
			notes += "\n" + info + "\n"
		}
		logs := c.diagnoseLogs(ctx)
		if logs != "" {
			notes += logs + "\n"
		}
	}

	return notes
}

func emptyStrSlice(s []string) bool {
	return len(s) == 0 || len(s) == 1 && s[0] == ""
}

func (c *containerRunner) diagnoseContainerInfo(ctx context.Context) string {
	info, err := c.dockerClient.ContainerInspect(ctx, c.id)
	if err != nil {
		return ""
	}

	notes := "Container config:\n"
	notes += fmt.Sprintf("Image: %s\n", info.Image)
	if info.Config != nil {
		notes += fmt.Sprintf("Entrypoint: %s\n", info.Config.Entrypoint)
		if len(info.Config.Cmd) > 0 && (len(info.Config.Cmd) > 1 || info.Config.Cmd[0] != "") {
			notes += fmt.Sprintf("Cmd: %s\n", info.Config.Cmd)
		}
	}

	if info.State != nil {
		if info.State.Error != "" {
			notes += fmt.Sprintf("Container state error: %s\n", info.State.Error)
		}
		if info.State.Running {
			notes += `Plugin is running but may have printed something unexpected to
stdout, where it should have printed '|' separated protocol negotiation info.
Check stdout in the logs below.
`
		} else {
			line := fmt.Sprintf("Plugin exited with exit code %d", info.State.ExitCode)
			switch info.State.ExitCode {
			case 1:
				line += "; this may be an error internal to the plugin"
			case 2:
				line += "; this may be due to a malformed command, or can also " +
					"happen when a cgo binary is run without libc bindings available"
			}
			notes += line + "\n"
		}
	}

	return notes
}

func (c *containerRunner) diagnoseLogs(ctx context.Context) string {
	logReader, err := c.dockerClient.ContainerLogs(ctx, c.id, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     false,
	})
	if err != nil {
		return err.Error()
	}
	defer logReader.Close()

	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	stdcopy.StdCopy(stdout, stderr, logReader)

	if stdout.Len() == 0 && stderr.Len() == 0 {
		return "No log lines from container\n"
	}

	return fmt.Sprintf(`--- Container Logs ---
Stdout:
%s
Stderr:
%s
--- End Logs ---`, stdout.String(), stderr.String())
}

// If the container runtime is rootless, our GroupAdd trick to make the Unix
// socket and folder writable from both sides stops working. Instead we have:
//
//  1. Run as root within the container still works. The container's root
//     user is not mapped to a different host user, so we get:
//
//     Host view: Running as 1000, container running as 1000, folder and socket owned by 1000.
//     Container view: Running as 0, folder and socket owned by 0.
//
//  2. Run as non-root within the container fails. The container runs as a
//     subordinate uid, with the mapping defined by /etc/subuid. e.g. if the host
//     unprivileged user is 1001(ubuntu), and /etc/subuid has the following entry:
//     ubuntu:100000:65536
//
//     Then running as user 1 inside the container will map to user 100000
//     on the host, and user 1001 will map to 101000.
//
//     Host view: Running as 1000, container running as 101000,
//     folder owned by 1000, socket owned by 101000.
//     => We need to make the socket writable for the host.
//
//     Container view: Running as 1001, folder owned by 0, socket owned by 1001.
//     => We need to make the folder writable for the container.
//
//     To fix the host permissions, we set default permissions on the folder
//     so any Unix sockets created in it are automatically writable.
//
//     To fix the container permissions, we give it the DAC_OVERRIDE capability,
//     which is normally on by default, and allows the container process to
//     ignore file system permission restrictions. The only bit of the host file
//     system it has access to though is the empty shared folder.
//
//     Similar to mlock and the IPC_LOCK capability, runc requires rootlesskit
//     (the container's parent process) to have the DAC_OVERRIDE capability
//     itself in order to delegate it to the container. However, runsc has no
//     such requirement because it reimplements the syscall in userspace.
//
// Note that the gVisor picture looks a little more complex in terms of how the
// process looks on the host as gVisor adds an extra layer between the container
// and the host, but the same file permission principles apply.
func configureDefaultACLsForRootless(hostSocketDir string) error {
	// Setting default ACLs for the socket folder using unix xattr.
	a := acl.FromUnix(0o660)
	a = append(a, acl.Entry{
		Tag:       acl.TagUser,
		Qualifier: strconv.Itoa(os.Geteuid()),
		Perms:     0o006,
	})
	a = append(a, acl.Entry{
		Tag:   acl.TagMask,
		Perms: 0o006,
	})
	if err := acl.SetDefault(hostSocketDir, a); err != nil {
		return fmt.Errorf("failed to set default ACLs on rootless socket directory: %w", err)
	}

	return nil
}
