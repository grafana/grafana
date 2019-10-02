package plugin

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"os"
	"os/signal"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/hashicorp/go-hclog"

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
// errors will be outputted to os.Stderr.
//
// This is the method that plugins should call in their main() functions.
func Serve(opts *ServeConfig) {
	// Validate the handshake config
	if opts.MagicCookieKey == "" || opts.MagicCookieValue == "" {
		fmt.Fprintf(os.Stderr,
			"Misconfigured ServeConfig given to serve this plugin: no magic cookie\n"+
				"key or value was set. Please notify the plugin author and report\n"+
				"this as a bug.\n")
		os.Exit(1)
	}

	// First check the cookie
	if os.Getenv(opts.MagicCookieKey) != opts.MagicCookieValue {
		fmt.Fprintf(os.Stderr,
			"This binary is a plugin. These are not meant to be executed directly.\n"+
				"Please execute the program that consumes these plugins, which will\n"+
				"load any plugins automatically\n")
		os.Exit(1)
	}

	// negotiate the version and plugins
	// start with default version in the handshake config
	protoVersion, protoType, pluginSet := protocolVersion(opts)

	// Logging goes to the original stderr
	log.SetOutput(os.Stderr)

	logger := opts.Logger
	if logger == nil {
		// internal logger to os.Stderr
		logger = hclog.New(&hclog.LoggerOptions{
			Level:      hclog.Trace,
			Output:     os.Stderr,
			JSONFormat: true,
		})
	}

	// Create our new stdout, stderr files. These will override our built-in
	// stdout/stderr so that it works across the stream boundary.
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

	// Register a listener so we can accept a connection
	listener, err := serverListener()
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
			logger.Error("failed to generate client certificate", "error", err)
			panic(err)
		}

		cert, err := tls.X509KeyPair(certPEM, keyPEM)
		if err != nil {
			logger.Error("failed to parse client certificate", "error", err)
			panic(err)
		}

		tlsConfig = &tls.Config{
			Certificates: []tls.Certificate{cert},
			ClientAuth:   tls.RequireAndVerifyClientCert,
			ClientCAs:    clientCertPool,
			MinVersion:   tls.VersionTLS12,
		}

		// We send back the raw leaf cert data for the client rather than the
		// PEM, since the protocol can't handle newlines.
		serverCert = base64.RawStdEncoding.EncodeToString(cert.Certificate[0])
	}

	// Create the channel to tell us when we're done
	doneCh := make(chan struct{})

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
		// Create the gRPC server
		server = &GRPCServer{
			Plugins: pluginSet,
			Server:  opts.GRPCServer,
			TLS:     tlsConfig,
			Stdout:  stdout_r,
			Stderr:  stderr_r,
			DoneCh:  doneCh,
			logger:  logger,
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

	// Output the address and service name to stdout so that the client can bring it up.
	fmt.Printf("%d|%d|%s|%s|%s|%s\n",
		CoreProtocolVersion,
		protoVersion,
		listener.Addr().Network(),
		listener.Addr().String(),
		protoType,
		serverCert)
	os.Stdout.Sync()

	// Eat the interrupts
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt)
	go func() {
		var count int32 = 0
		for {
			<-ch
			newCount := atomic.AddInt32(&count, 1)
			logger.Debug("plugin received interrupt signal, ignoring", "count", newCount)
		}
	}()

	// Set our new out, err
	os.Stdout = stdout_w
	os.Stderr = stderr_w

	// Accept connections and wait for completion
	go server.Serve(listener)
	<-doneCh
}

func serverListener() (net.Listener, error) {
	if runtime.GOOS == "windows" {
		return serverListener_tcp()
	}

	return serverListener_unix()
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
		return nil, fmt.Errorf("ENV_MIN_PORT value of %d is greater than PLUGIN_MAX_PORT value of %d", minPort, maxPort)
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

func serverListener_unix() (net.Listener, error) {
	tf, err := ioutil.TempFile("", "plugin")
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

	// Wrap the listener in rmListener so that the Unix domain socket file
	// is removed on close.
	return &rmListener{
		Listener: l,
		Path:     path,
	}, nil
}

// rmListener is an implementation of net.Listener that forwards most
// calls to the listener but also removes a file as part of the close. We
// use this to cleanup the unix domain socket on close.
type rmListener struct {
	net.Listener
	Path string
}

func (l *rmListener) Close() error {
	// Close the listener itself
	if err := l.Listener.Close(); err != nil {
		return err
	}

	// Remove the file
	return os.Remove(l.Path)
}
