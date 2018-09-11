package plugin

import (
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"os"
	"os/signal"
	"runtime"
	"strconv"
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
	ProtocolVersion uint

	// MagicCookieKey and value are used as a very basic verification
	// that a plugin is intended to be launched. This is not a security
	// measure, just a UX feature. If the magic cookie doesn't match,
	// we show human-friendly output.
	MagicCookieKey   string
	MagicCookieValue string
}

// ServeConfig configures what sorts of plugins are served.
type ServeConfig struct {
	// HandshakeConfig is the configuration that must match clients.
	HandshakeConfig

	// TLSProvider is a function that returns a configured tls.Config.
	TLSProvider func() (*tls.Config, error)

	// Plugins are the plugins that are served.
	Plugins map[string]Plugin

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

// Protocol returns the protocol that this server should speak.
func (c *ServeConfig) Protocol() Protocol {
	result := ProtocolNetRPC
	if c.GRPCServer != nil {
		result = ProtocolGRPC
	}

	return result
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

	// Create the channel to tell us when we're done
	doneCh := make(chan struct{})

	// Build the server type
	var server ServerProtocol
	switch opts.Protocol() {
	case ProtocolNetRPC:
		// If we have a TLS configuration then we wrap the listener
		// ourselves and do it at that level.
		if tlsConfig != nil {
			listener = tls.NewListener(listener, tlsConfig)
		}

		// Create the RPC server to dispense
		server = &RPCServer{
			Plugins: opts.Plugins,
			Stdout:  stdout_r,
			Stderr:  stderr_r,
			DoneCh:  doneCh,
		}

	case ProtocolGRPC:
		// Create the gRPC server
		server = &GRPCServer{
			Plugins: opts.Plugins,
			Server:  opts.GRPCServer,
			TLS:     tlsConfig,
			Stdout:  stdout_r,
			Stderr:  stderr_r,
			DoneCh:  doneCh,
		}

	default:
		panic("unknown server protocol: " + opts.Protocol())
	}

	// Initialize the servers
	if err := server.Init(); err != nil {
		logger.Error("protocol init", "error", err)
		return
	}

	// Build the extra configuration
	extra := ""
	if v := server.Config(); v != "" {
		extra = base64.StdEncoding.EncodeToString([]byte(v))
	}
	if extra != "" {
		extra = "|" + extra
	}

	logger.Debug("plugin address", "network", listener.Addr().Network(), "address", listener.Addr().String())

	// Output the address and service name to stdout so that core can bring it up.
	fmt.Printf("%d|%d|%s|%s|%s%s\n",
		CoreProtocolVersion,
		opts.ProtocolVersion,
		listener.Addr().Network(),
		listener.Addr().String(),
		opts.Protocol(),
		extra)
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
	minPort, err := strconv.ParseInt(os.Getenv("PLUGIN_MIN_PORT"), 10, 32)
	if err != nil {
		return nil, err
	}

	maxPort, err := strconv.ParseInt(os.Getenv("PLUGIN_MAX_PORT"), 10, 32)
	if err != nil {
		return nil, err
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
