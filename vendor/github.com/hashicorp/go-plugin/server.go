// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"os/user"
	"runtime"
	"sort"
	"strconv"
	"strings"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin/internal/grpcmux"
	"google.golang.org/grpc"
)

// CoreProtocolVersion is the ProtocolVersion of the plugin system itself.
// We will increment this whenever we change any protocol behavior. This
// will invalidate any prior plugins but will at least allow us to iterate
// on the core in a safe way. We will do our best to do this very
// infrequently.
const CoreProtocolVersion = 1

// HandshakeConfig is the configuration used by client and servers to
// handshake before starting a plugin connection. This is embedded by
// both ServeConfig and ClientConfig.
//
// In practice, the plugin host creates a HandshakeConfig that is exported
// and plugins then can easily consume it.
type HandshakeConfig struct {
	// ProtocolVersion is the version that clients must match on to
	// agree they can communicate. This should match the ProtocolVersion
	// set on ClientConfig when using a plugin.
	// This field is not required if VersionedPlugins are being used in the
	// Client or Server configurations.
	ProtocolVersion uint

	// MagicCookieKey and value are used as a very basic verification
	// that a plugin is intended to be launched. This is not a security
	// measure, just a UX feature. If the magic cookie doesn't match,
	// we show human-friendly output.
	MagicCookieKey   string
	MagicCookieValue string
}

// PluginSet is a set of plugins provided to be registered in the plugin
// server.
type PluginSet map[string]Plugin

// ServeConfig configures what sorts of plugins are served.
type ServeConfig struct {
	// HandshakeConfig is the configuration that must match clients.
	HandshakeConfig

	// TLSProvider is a function that returns a configured tls.Config.
	TLSProvider func() (*tls.Config, error)

	// Plugins are the plugins that are served.
	// The implied version of this PluginSet is the Handshake.ProtocolVersion.
	Plugins PluginSet

	// VersionedPlugins is a map of PluginSets for specific protocol versions.
	// These can be used to negotiate a compatible version between client and
	// server. If this is set, Handshake.ProtocolVersion is not required.
	VersionedPlugins map[int]PluginSet

	// GRPCServer should be non-nil to enable serving the plugins over
	// gRPC. This is a function to create the server when needed with the
	// given server options. The server options populated by go-plugin will
	// be for TLS if set. You may modify the input slice.
	//
	// Note that the grpc.Server will automatically be registered with
	// the gRPC health checking service. This is not optional since go-plugin
	// relies on this to implement Ping().
	GRPCServer func([]grpc.ServerOption) *grpc.Server

	// Logger is used to pass a logger into the server. If none is provided the
	// server will create a default logger.
	Logger hclog.Logger

	// Test, if non-nil, will put plugin serving into "test mode". This is
	// meant to be used as part of `go test` within a plugin's codebase to
	// launch the plugin in-process and output a ReattachConfig.
	//
	// This changes the behavior of the server in a number of ways to
	// accomodate the expectation of running in-process:
	//
	//   * The handshake cookie is not validated.
	//   * Stdout/stderr will receive plugin reads and writes
	//   * Connection information will not be sent to stdout
	//
	Test *ServeTestConfig
}

// ServeTestConfig configures plugin serving for test mode. See ServeConfig.Test.
type ServeTestConfig struct {
	// Context, if set, will force the plugin serving to end when cancelled.
	// This is only a test configuration because the non-test configuration
	// expects to take over the process and therefore end on an interrupt or
	// kill signal. For tests, we need to kill the plugin serving routinely
	// and this provides a way to do so.
	//
	// If you want to wait for the plugin process to close before moving on,
	// you can wait on CloseCh.
	Context context.Context

	// If this channel is non-nil, we will send the ReattachConfig via
	// this channel. This can be encoded (via JSON recommended) to the
	// plugin client to attach to this plugin.
	ReattachConfigCh chan<- *ReattachConfig

	// CloseCh, if non-nil, will be closed when serving exits. This can be
	// used along with Context to determine when the server is fully shut down.
	// If this is not set, you can still use Context on its own, but note there
	// may be a period of time between canceling the context and the plugin
	// server being shut down.
	CloseCh chan<- struct{}

	// SyncStdio, if true, will enable the client side "SyncStdout/Stderr"
	// functionality to work. This defaults to false because the implementation
	// of making this work within test environments is particularly messy
	// and SyncStdio functionality is fairly rare, so we default to the simple
	// scenario.
	SyncStdio bool
}

func unixSocketConfigFromEnv() UnixSocketConfig {
	return UnixSocketConfig{
		Group:     os.Getenv(EnvUnixSocketGroup),
		socketDir: os.Getenv(EnvUnixSocketDir),
	}
}

// protocolVersion determines the protocol version and plugin set to be used by
// the server. In the event that there is no suitable version, the last version
// in the config is returned leaving the client to report the incompatibility.
func protocolVersion(opts *ServeConfig) (int, Protocol, PluginSet) {
	protoVersion := int(opts.ProtocolVersion)
	pluginSet := opts.Plugins
	protoType := ProtocolNetRPC
	// Check if the client sent a list of acceptable versions
	var clientVersions []int
	if vs := os.Getenv("PLUGIN_PROTOCOL_VERSIONS"); vs != "" {
		for _, s := range strings.Split(vs, ",") {
			v, err := strconv.Atoi(s)
			if err != nil {
				fmt.Fprintf(os.Stderr, "server sent invalid plugin version %q", s)
				continue
			}
			clientVersions = append(clientVersions, v)
		}
	}

	// We want to iterate in reverse order, to ensure we match the newest
	// compatible plugin version.
	sort.Sort(sort.Reverse(sort.IntSlice(clientVersions)))

	// set the old un-versioned fields as if they were versioned plugins
	if opts.VersionedPlugins == nil {
		opts.VersionedPlugins = make(map[int]PluginSet)
	}

	if pluginSet != nil {
		opts.VersionedPlugins[protoVersion] = pluginSet
	}

	// Sort the version to make sure we match the latest first
	var versions []int
	for v := range opts.VersionedPlugins {
		versions = append(versions, v)
	}

	sort.Sort(sort.Reverse(sort.IntSlice(versions)))

	// See if we have multiple versions of Plugins to choose from
	for _, version := range versions {
		// Record each version, since we guarantee that this returns valid
		// values even if they are not a protocol match.
		protoVersion = version
		pluginSet = opts.VersionedPlugins[version]

		// If we have a configured gRPC server we should select a protocol
		if opts.GRPCServer != nil {
			// All plugins in a set must use the same transport, so check the first
			// for the protocol type
			for _, p := range pluginSet {
				switch p.(type) {
				case GRPCPlugin:
					protoType = ProtocolGRPC
				default:
					protoType = ProtocolNetRPC
				}
				break
			}
		}

		for _, clientVersion := range clientVersions {
			if clientVersion == protoVersion {
				return protoVersion, protoType, pluginSet
			}
		}
	}

	// Return the lowest version as the fallback.
	// Since we iterated over all the versions in reverse order above, these
	// values are from the lowest version number plugins (which may be from
	// a combination of the Handshake.ProtocolVersion and ServeConfig.Plugins
	// fields). This allows serving the oldest version of our plugins to a
	// legacy client that did not send a PLUGIN_PROTOCOL_VERSIONS list.
	return protoVersion, protoType, pluginSet
}

// Serve serves the plugins given by ServeConfig.
//
// Serve doesn't return until the plugin is done being executed. Any
// fixable errors will be output to os.Stderr and the process will
// exit with a status code of 1. Serve will panic for unexpected
// conditions where a user's fix is unknown.
//
// This is the method that plugins should call in their main() functions.
func Serve(opts *ServeConfig) {
	exitCode := -1
	// We use this to trigger an `os.Exit` so that we can execute our other
	// deferred functions. In test mode, we just output the err to stderr
	// and return.
	defer func() {
		if opts.Test == nil && exitCode >= 0 {
			os.Exit(exitCode)
		}

		if opts.Test != nil && opts.Test.CloseCh != nil {
			close(opts.Test.CloseCh)
		}
	}()

	if opts.Test == nil {
		// Validate the handshake config
		if opts.MagicCookieKey == "" || opts.MagicCookieValue == "" {
			fmt.Fprintf(os.Stderr,
				"Misconfigured ServeConfig given to serve this plugin: no magic cookie\n"+
					"key or value was set. Please notify the plugin author and report\n"+
					"this as a bug.\n")
			exitCode = 1
			return
		}

		// First check the cookie
		if os.Getenv(opts.MagicCookieKey) != opts.MagicCookieValue {
			fmt.Fprintf(os.Stderr,
				"This binary is a plugin. These are not meant to be executed directly.\n"+
					"Please execute the program that consumes these plugins, which will\n"+
					"load any plugins automatically\n")
			exitCode = 1
			return
		}
	}

	// negotiate the version and plugins
	// start with default version in the handshake config
	protoVersion, protoType, pluginSet := protocolVersion(opts)

	logger := opts.Logger
	if logger == nil {
		// internal logger to os.Stderr
		logger = hclog.New(&hclog.LoggerOptions{
			Level:      hclog.Trace,
			Output:     os.Stderr,
			JSONFormat: true,
		})
	}

	// Register a listener so we can accept a connection
	listener, err := serverListener(unixSocketConfigFromEnv())
	if err != nil {
		logger.Error("plugin init error", "error", err)
		return
	}

	// Close the listener on return. We wrap this in a func() on purpose
	// because the "listener" reference may change to TLS.
	defer func() {
		listener.Close()
	}()

	var tlsConfig *tls.Config
	if opts.TLSProvider != nil {
		tlsConfig, err = opts.TLSProvider()
		if err != nil {
			logger.Error("plugin tls init", "error", err)
			return
		}
	}

	var serverCert string
	clientCert := os.Getenv("PLUGIN_CLIENT_CERT")
	// If the client is configured using AutoMTLS, the certificate will be here,
	// and we need to generate our own in response.
	if tlsConfig == nil && clientCert != "" {
		logger.Info("configuring server automatic mTLS")
		clientCertPool := x509.NewCertPool()
		if !clientCertPool.AppendCertsFromPEM([]byte(clientCert)) {
			logger.Error("client cert provided but failed to parse", "cert", clientCert)
		}

		certPEM, keyPEM, err := generateCert()
		if err != nil {
			logger.Error("failed to generate server certificate", "error", err)
			panic(err)
		}

		cert, err := tls.X509KeyPair(certPEM, keyPEM)
		if err != nil {
			logger.Error("failed to parse server certificate", "error", err)
			panic(err)
		}

		tlsConfig = &tls.Config{
			Certificates: []tls.Certificate{cert},
			ClientAuth:   tls.RequireAndVerifyClientCert,
			ClientCAs:    clientCertPool,
			MinVersion:   tls.VersionTLS12,
			RootCAs:      clientCertPool,
			ServerName:   "localhost",
		}

		// We send back the raw leaf cert data for the client rather than the
		// PEM, since the protocol can't handle newlines.
		serverCert = base64.RawStdEncoding.EncodeToString(cert.Certificate[0])
	}

	// Create the channel to tell us when we're done
	doneCh := make(chan struct{})

	// Create our new stdout, stderr files. These will override our built-in
	// stdout/stderr so that it works across the stream boundary.
	var stdout_r, stderr_r io.Reader
	stdout_r, stdout_w, err := os.Pipe()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error preparing plugin: %s\n", err)
		os.Exit(1)
	}
	stderr_r, stderr_w, err := os.Pipe()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error preparing plugin: %s\n", err)
		os.Exit(1)
	}

	// If we're in test mode, we tee off the reader and write the data
	// as-is to our normal Stdout and Stderr so that they continue working
	// while stdio works. This is because in test mode, we assume we're running
	// in `go test` or some equivalent and we want output to go to standard
	// locations.
	if opts.Test != nil {
		// TODO(mitchellh): This isn't super ideal because a TeeReader
		// only works if the reader side is actively read. If we never
		// connect via a plugin client, the output still gets swallowed.
		stdout_r = io.TeeReader(stdout_r, os.Stdout)
		stderr_r = io.TeeReader(stderr_r, os.Stderr)
	}

	// Build the server type
	var server ServerProtocol
	switch protoType {
	case ProtocolNetRPC:
		// If we have a TLS configuration then we wrap the listener
		// ourselves and do it at that level.
		if tlsConfig != nil {
			listener = tls.NewListener(listener, tlsConfig)
		}

		// Create the RPC server to dispense
		server = &RPCServer{
			Plugins: pluginSet,
			Stdout:  stdout_r,
			Stderr:  stderr_r,
			DoneCh:  doneCh,
		}

	case ProtocolGRPC:
		var muxer *grpcmux.GRPCServerMuxer
		if multiplex, _ := strconv.ParseBool(os.Getenv(envMultiplexGRPC)); multiplex {
			muxer = grpcmux.NewGRPCServerMuxer(logger, listener)
			listener = muxer
		}

		// Create the gRPC server
		server = &GRPCServer{
			Plugins: pluginSet,
			Server:  opts.GRPCServer,
			TLS:     tlsConfig,
			Stdout:  stdout_r,
			Stderr:  stderr_r,
			DoneCh:  doneCh,
			logger:  logger,
			muxer:   muxer,
		}

	default:
		panic("unknown server protocol: " + protoType)
	}

	// Initialize the servers
	if err := server.Init(); err != nil {
		logger.Error("protocol init", "error", err)
		return
	}

	logger.Debug("plugin address", "network", listener.Addr().Network(), "address", listener.Addr().String())

	// Output the address and service name to stdout so that the client can
	// bring it up. In test mode, we don't do this because clients will
	// attach via a reattach config.
	if opts.Test == nil {
		const grpcBrokerMultiplexingSupported = true
		protocolLine := fmt.Sprintf("%d|%d|%s|%s|%s|%s",
			CoreProtocolVersion,
			protoVersion,
			listener.Addr().Network(),
			listener.Addr().String(),
			protoType,
			serverCert)

		// Old clients will error with new plugins if we blindly append the
		// seventh segment for gRPC broker multiplexing support, because old
		// client code uses strings.SplitN(line, "|", 6), which means a seventh
		// segment will get appended to the sixth segment as "sixthpart|true".
		//
		// If the environment variable is set, we assume the client is new enough
		// to handle a seventh segment, as it should now use
		// strings.Split(line, "|") and always handle each segment individually.
		if os.Getenv(envMultiplexGRPC) != "" {
			protocolLine += fmt.Sprintf("|%v", grpcBrokerMultiplexingSupported)
		}
		fmt.Printf("%s\n", protocolLine)
		os.Stdout.Sync()
	} else if ch := opts.Test.ReattachConfigCh; ch != nil {
		// Send back the reattach config that can be used. This isn't
		// quite ready if they connect immediately but the client should
		// retry a few times.
		ch <- &ReattachConfig{
			Protocol:        protoType,
			ProtocolVersion: protoVersion,
			Addr:            listener.Addr(),
			Pid:             os.Getpid(),
			Test:            true,
		}
	}

	// Eat the interrupts. In test mode we disable this so that go test
	// can be cancelled properly.
	if opts.Test == nil {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, os.Interrupt)
		go func() {
			count := 0
			for {
				<-ch
				count++
				logger.Trace("plugin received interrupt signal, ignoring", "count", count)
			}
		}()
	}

	// Set our stdout, stderr to the stdio stream that clients can retrieve
	// using ClientConfig.SyncStdout/err. We only do this for non-test mode
	// or if the test mode explicitly requests it.
	//
	// In test mode, we use a multiwriter so that the data continues going
	// to the normal stdout/stderr so output can show up in test logs. We
	// also send to the stdio stream so that clients can continue working
	// if they depend on that.
	if opts.Test == nil || opts.Test.SyncStdio {
		if opts.Test != nil {
			// In test mode we need to maintain the original values so we can
			// reset it.
			defer func(out, err *os.File) {
				os.Stdout = out
				os.Stderr = err
			}(os.Stdout, os.Stderr)
		}
		os.Stdout = stdout_w
		os.Stderr = stderr_w
	}

	// Accept connections and wait for completion
	go server.Serve(listener)

	ctx := context.Background()
	if opts.Test != nil && opts.Test.Context != nil {
		ctx = opts.Test.Context
	}
	select {
	case <-ctx.Done():
		// Cancellation. We can stop the server by closing the listener.
		// This isn't graceful at all but this is currently only used by
		// tests and its our only way to stop.
		listener.Close()

		// If this is a grpc server, then we also ask the server itself to
		// end which will kill all connections. There isn't an easy way to do
		// this for net/rpc currently but net/rpc is more and more unused.
		if s, ok := server.(*GRPCServer); ok {
			s.Stop()
		}

		// Wait for the server itself to shut down
		<-doneCh

	case <-doneCh:
		// Note that given the documentation of Serve we should probably be
		// setting exitCode = 0 and using os.Exit here. That's how it used to
		// work before extracting this library. However, for years we've done
		// this so we'll keep this functionality.
	}
}

func serverListener(unixSocketCfg UnixSocketConfig) (net.Listener, error) {
	if runtime.GOOS == "windows" {
		return serverListener_tcp()
	}

	return serverListener_unix(unixSocketCfg)
}

func serverListener_tcp() (net.Listener, error) {
	envMinPort := os.Getenv("PLUGIN_MIN_PORT")
	envMaxPort := os.Getenv("PLUGIN_MAX_PORT")

	var minPort, maxPort int64
	var err error

	switch {
	case len(envMinPort) == 0:
		minPort = 0
	default:
		minPort, err = strconv.ParseInt(envMinPort, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("Couldn't get value from PLUGIN_MIN_PORT: %v", err)
		}
	}

	switch {
	case len(envMaxPort) == 0:
		maxPort = 0
	default:
		maxPort, err = strconv.ParseInt(envMaxPort, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("Couldn't get value from PLUGIN_MAX_PORT: %v", err)
		}
	}

	if minPort > maxPort {
		return nil, fmt.Errorf("PLUGIN_MIN_PORT value of %d is greater than PLUGIN_MAX_PORT value of %d", minPort, maxPort)
	}

	for port := minPort; port <= maxPort; port++ {
		address := fmt.Sprintf("127.0.0.1:%d", port)
		listener, err := net.Listen("tcp", address)
		if err == nil {
			return listener, nil
		}
	}

	return nil, errors.New("Couldn't bind plugin TCP listener")
}

func serverListener_unix(unixSocketCfg UnixSocketConfig) (net.Listener, error) {
	tf, err := os.CreateTemp(unixSocketCfg.socketDir, "plugin")
	if err != nil {
		return nil, err
	}
	path := tf.Name()

	// Close the file and remove it because it has to not exist for
	// the domain socket.
	if err := tf.Close(); err != nil {
		return nil, err
	}
	if err := os.Remove(path); err != nil {
		return nil, err
	}

	l, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}

	// By default, unix sockets are only writable by the owner. Set up a custom
	// group owner and group write permissions if configured.
	if unixSocketCfg.Group != "" {
		err = setGroupWritable(path, unixSocketCfg.Group, 0o660)
		if err != nil {
			return nil, err
		}
	}

	// Wrap the listener in rmListener so that the Unix domain socket file
	// is removed on close.
	return newDeleteFileListener(l, path), nil
}

func setGroupWritable(path, groupString string, mode os.FileMode) error {
	groupID, err := strconv.Atoi(groupString)
	if err != nil {
		group, err := user.LookupGroup(groupString)
		if err != nil {
			return fmt.Errorf("failed to find gid from %q: %w", groupString, err)
		}
		groupID, err = strconv.Atoi(group.Gid)
		if err != nil {
			return fmt.Errorf("failed to parse %q group's gid as an integer: %w", groupString, err)
		}
	}

	err = os.Chown(path, -1, groupID)
	if err != nil {
		return err
	}

	err = os.Chmod(path, mode)
	if err != nil {
		return err
	}

	return nil
}

// rmListener is an implementation of net.Listener that forwards most
// calls to the listener but also calls an additional close function. We
// use this to cleanup the unix domain socket on close, as well as clean
// up multiplexed listeners.
type rmListener struct {
	net.Listener
	close func() error
}

func newDeleteFileListener(ln net.Listener, path string) *rmListener {
	return &rmListener{
		Listener: ln,
		close: func() error {
			return os.Remove(path)
		},
	}
}

func (l *rmListener) Close() error {
	// Close the listener itself
	if err := l.Listener.Close(); err != nil {
		return err
	}

	// Remove the file
	return l.close()
}
