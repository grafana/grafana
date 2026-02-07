package testcontainers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"

	"github.com/testcontainers/testcontainers-go/internal/core/network"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	// hubSshdImage {
	sshdImage string = "testcontainers/sshd:1.2.0"
	// }

	// HostInternal is the internal hostname used to reach the host from the container,
	// using the SSHD container as a bridge.
	HostInternal string = "host.testcontainers.internal"
	user         string = "root"
	sshPort             = "22/tcp"
)

// sshPassword is a random password generated for the SSHD container.
var sshPassword = uuid.NewString()

// exposeHostPorts performs all the necessary steps to expose the host ports to the container, leveraging
// the SSHD container to create the tunnel, and the container lifecycle hooks to manage the tunnel lifecycle.
// At least one port must be provided to expose.
// The steps are:
// 1. Create a new SSHD container.
// 2. Expose the host ports to the container after the container is ready.
// 3. Close the SSH sessions before killing the container.
func exposeHostPorts(ctx context.Context, req *ContainerRequest, ports ...int) (sshdConnectHook ContainerLifecycleHooks, err error) {
	if len(ports) == 0 {
		return sshdConnectHook, errors.New("no ports to expose")
	}

	// Use the first network of the container to connect to the SSHD container.
	var sshdFirstNetwork string
	if len(req.Networks) > 0 {
		sshdFirstNetwork = req.Networks[0]
	}

	if sshdFirstNetwork == "bridge" && len(req.Networks) > 1 {
		sshdFirstNetwork = req.Networks[1]
	}

	opts := []ContainerCustomizer{}
	if len(req.Networks) > 0 {
		// get the first network of the container to connect the SSHD container to it.
		nw, err := network.GetByName(ctx, sshdFirstNetwork)
		if err != nil {
			return sshdConnectHook, fmt.Errorf("get network %q: %w", sshdFirstNetwork, err)
		}

		dockerNw := DockerNetwork{
			ID:   nw.ID,
			Name: nw.Name,
		}

		// WithNetwork reuses an already existing network, attaching the container to it.
		// Finally it sets the network alias on that network to the given alias.
		// TODO: Using an anonymous function to avoid cyclic dependencies with the network package.
		withNetwork := func(aliases []string, nw *DockerNetwork) CustomizeRequestOption {
			return func(req *GenericContainerRequest) error {
				networkName := nw.Name

				// attaching to the network because it was created with success or it already existed.
				req.Networks = append(req.Networks, networkName)

				if req.NetworkAliases == nil {
					req.NetworkAliases = make(map[string][]string)
				}
				req.NetworkAliases[networkName] = aliases
				return nil
			}
		}

		opts = append(opts, withNetwork([]string{HostInternal}, &dockerNw))
	}

	// start the SSHD container with the provided options
	sshdContainer, err := newSshdContainer(ctx, opts...)
	// Ensure the SSHD container is stopped and removed in case of error.
	defer func() {
		if err != nil {
			err = errors.Join(err, TerminateContainer(sshdContainer))
		}
	}()
	if err != nil {
		return sshdConnectHook, fmt.Errorf("new sshd container: %w", err)
	}

	// IP in the first network of the container.
	inspect, err := sshdContainer.Inspect(ctx)
	if err != nil {
		return sshdConnectHook, fmt.Errorf("inspect sshd container: %w", err)
	}

	// TODO: remove once we have docker context support via #2810
	sshdIP := inspect.NetworkSettings.IPAddress
	if sshdIP == "" {
		single := len(inspect.NetworkSettings.Networks) == 1
		for name, network := range inspect.NetworkSettings.Networks {
			if name == sshdFirstNetwork || single {
				sshdIP = network.IPAddress
				break
			}
		}
	}

	if sshdIP == "" {
		return sshdConnectHook, errors.New("sshd container IP not found")
	}

	if req.HostConfigModifier == nil {
		req.HostConfigModifier = func(_ *container.HostConfig) {}
	}

	// do not override the original HostConfigModifier
	originalHCM := req.HostConfigModifier
	req.HostConfigModifier = func(hostConfig *container.HostConfig) {
		// adding the host internal alias to the container as an extra host
		// to allow the container to reach the SSHD container.
		hostConfig.ExtraHosts = append(hostConfig.ExtraHosts, fmt.Sprintf("%s:%s", HostInternal, sshdIP))

		modes := []container.NetworkMode{container.NetworkMode(sshdFirstNetwork), "none", "host"}
		// if the container is not in one of the modes, attach it to the first network of the SSHD container
		found := false
		for _, mode := range modes {
			if hostConfig.NetworkMode == mode {
				found = true
				break
			}
		}
		if !found {
			req.Networks = append(req.Networks, sshdFirstNetwork)
		}

		// invoke the original HostConfigModifier with the updated hostConfig
		originalHCM(hostConfig)
	}

	stopHooks := []ContainerHook{
		func(ctx context.Context, _ Container) error {
			if ctx.Err() != nil {
				// Context already canceled, need to create a new one to ensure
				// the SSH session is closed.
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
			}

			return TerminateContainer(sshdContainer, StopContext(ctx))
		},
	}

	// after the container is ready, create the SSH tunnel
	// for each exposed port from the host.
	sshdConnectHook = ContainerLifecycleHooks{
		PostReadies: []ContainerHook{
			func(ctx context.Context, _ Container) error {
				return sshdContainer.exposeHostPort(ctx, req.HostAccessPorts...)
			},
		},
		PreStops:      stopHooks,
		PreTerminates: stopHooks,
	}

	return sshdConnectHook, nil
}

// newSshdContainer creates a new SSHD container with the provided options.
func newSshdContainer(ctx context.Context, opts ...ContainerCustomizer) (*sshdContainer, error) {
	req := GenericContainerRequest{
		ContainerRequest: ContainerRequest{
			Image:        sshdImage,
			ExposedPorts: []string{sshPort},
			Env:          map[string]string{"PASSWORD": sshPassword},
			WaitingFor:   wait.ForListeningPort(sshPort),
		},
		Started: true,
	}

	for _, opt := range opts {
		if err := opt.Customize(&req); err != nil {
			return nil, err
		}
	}

	c, err := GenericContainer(ctx, req)
	var sshd *sshdContainer
	if c != nil {
		sshd = &sshdContainer{Container: c}
	}

	if err != nil {
		return sshd, fmt.Errorf("generic container: %w", err)
	}

	if err = sshd.clientConfig(ctx); err != nil {
		// Return the container and the error to the caller to handle it.
		return sshd, err
	}

	return sshd, nil
}

// sshdContainer represents the SSHD container type used for the port forwarding container.
// It's an internal type that extends the DockerContainer type, to add the SSH tunnelling capabilities.
type sshdContainer struct {
	Container
	port           string
	sshConfig      *ssh.ClientConfig
	portForwarders []*portForwarder
}

// Terminate stops the container and closes the SSH session
func (sshdC *sshdContainer) Terminate(ctx context.Context, opts ...TerminateOption) error {
	return errors.Join(
		sshdC.closePorts(),
		sshdC.Container.Terminate(ctx, opts...),
	)
}

// Stop stops the container and closes the SSH session
func (sshdC *sshdContainer) Stop(ctx context.Context, timeout *time.Duration) error {
	return errors.Join(
		sshdC.closePorts(),
		sshdC.Container.Stop(ctx, timeout),
	)
}

// closePorts closes all port forwarders.
func (sshdC *sshdContainer) closePorts() error {
	var errs []error
	for _, pfw := range sshdC.portForwarders {
		if err := pfw.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	sshdC.portForwarders = nil // Ensure the port forwarders are not used after closing.
	return errors.Join(errs...)
}

// clientConfig sets up the SSHD client configuration.
func (sshdC *sshdContainer) clientConfig(ctx context.Context) error {
	mappedPort, err := sshdC.MappedPort(ctx, sshPort)
	if err != nil {
		return fmt.Errorf("mapped port: %w", err)
	}

	sshdC.port = mappedPort.Port()
	sshdC.sshConfig = &ssh.ClientConfig{
		User:            user,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Auth:            []ssh.AuthMethod{ssh.Password(sshPassword)},
	}

	return nil
}

// exposeHostPort exposes the host ports to the container.
func (sshdC *sshdContainer) exposeHostPort(ctx context.Context, ports ...int) (err error) {
	defer func() {
		if err != nil {
			err = errors.Join(err, sshdC.closePorts())
		}
	}()
	for _, port := range ports {
		pf, err := newPortForwarder(ctx, "localhost:"+sshdC.port, sshdC.sshConfig, port)
		if err != nil {
			return fmt.Errorf("new port forwarder: %w", err)
		}

		sshdC.portForwarders = append(sshdC.portForwarders, pf)
	}

	return nil
}

// portForwarder forwards a port from the container to the host.
type portForwarder struct {
	client      *ssh.Client
	listener    net.Listener
	dialTimeout time.Duration
	localAddr   string
	ctx         context.Context
	cancel      context.CancelFunc

	// closeMtx protects the close operation
	closeMtx sync.Mutex
	closeErr error
}

// newPortForwarder creates a new running portForwarder for the given port.
// The context is only used for the initial SSH connection.
func newPortForwarder(ctx context.Context, sshDAddr string, sshConfig *ssh.ClientConfig, port int) (pf *portForwarder, err error) {
	var d net.Dialer
	conn, err := d.DialContext(ctx, "tcp", sshDAddr)
	if err != nil {
		return nil, fmt.Errorf("ssh dial: %w", err)
	}

	// Ensure the connection is closed in case of error.
	defer func() {
		if err != nil {
			err = errors.Join(err, conn.Close())
		}
	}()

	c, chans, reqs, err := ssh.NewClientConn(conn, sshDAddr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("ssh new client conn: %w", err)
	}

	client := ssh.NewClient(c, chans, reqs)

	listener, err := client.Listen("tcp", fmt.Sprintf("localhost:%d", port))
	if err != nil {
		return nil, fmt.Errorf("listening on remote port %d: %w", port, err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	pf = &portForwarder{
		client:      client,
		listener:    listener,
		localAddr:   fmt.Sprintf("localhost:%d", port),
		ctx:         ctx,
		cancel:      cancel,
		dialTimeout: time.Second * 2,
	}

	go pf.run()

	return pf, nil
}

// Close closes the port forwarder.
func (pf *portForwarder) Close() error {
	pf.closeMtx.Lock()
	defer pf.closeMtx.Unlock()

	select {
	case <-pf.ctx.Done():
		// Already closed.
		return pf.closeErr
	default:
	}

	var errs []error
	if err := pf.listener.Close(); err != nil {
		errs = append(errs, fmt.Errorf("close listener: %w", err))
	}
	if err := pf.client.Close(); err != nil {
		errs = append(errs, fmt.Errorf("close client: %w", err))
	}

	pf.closeErr = errors.Join(errs...)
	pf.cancel()

	return pf.closeErr
}

// run forwards the port from the remote connection to the local connection.
func (pf *portForwarder) run() {
	for {
		remote, err := pf.listener.Accept()
		if err != nil {
			if errors.Is(err, io.EOF) {
				// The listener has been closed.
				return
			}

			// Ignore errors as they are transient and we want requests to
			// continue to be accepted.
			continue
		}

		go pf.tunnel(remote)
	}
}

// tunnel runs a tunnel between two connections; as soon as the forwarder
// context is cancelled or one connection copies returns, irrespective of
// the error, both connections are closed.
func (pf *portForwarder) tunnel(remote net.Conn) {
	defer remote.Close()

	ctx, cancel := context.WithTimeout(pf.ctx, pf.dialTimeout)
	defer cancel()

	var dialer net.Dialer
	local, err := dialer.DialContext(ctx, "tcp", pf.localAddr)
	if err != nil {
		// Nothing we can do with the error.
		return
	}
	defer local.Close()

	ctx, cancel = context.WithCancel(pf.ctx)

	go func() {
		defer cancel()
		io.Copy(local, remote) //nolint:errcheck // Nothing useful we can do with the error.
	}()

	go func() {
		defer cancel()
		io.Copy(remote, local) //nolint:errcheck // Nothing useful we can do with the error.
	}()

	// Wait for the context to be done before returning which triggers
	// both connections to close. This is done to prevent the copies
	// blocking forever on unused connections.
	<-ctx.Done()
}
