package plugin

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin/internal/plugin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

// GRPCServiceName is the name of the service that the health check should
// return as passing.
const GRPCServiceName = "plugin"

// DefaultGRPCServer can be used with the "GRPCServer" field for Server
// as a default factory method to create a gRPC server with no extra options.
func DefaultGRPCServer(opts []grpc.ServerOption) *grpc.Server {
	return grpc.NewServer(opts...)
}

// GRPCServer is a ServerType implementation that serves plugins over
// gRPC. This allows plugins to easily be written for other languages.
//
// The GRPCServer outputs a custom configuration as a base64-encoded
// JSON structure represented by the GRPCServerConfig config structure.
type GRPCServer struct {
	// Plugins are the list of plugins to serve.
	Plugins map[string]Plugin

	// Server is the actual server that will accept connections. This
	// will be used for plugin registration as well.
	Server func([]grpc.ServerOption) *grpc.Server

	// TLS should be the TLS configuration if available. If this is nil,
	// the connection will not have transport security.
	TLS *tls.Config

	// DoneCh is the channel that is closed when this server has exited.
	DoneCh chan struct{}

	// Stdout/StderrLis are the readers for stdout/stderr that will be copied
	// to the stdout/stderr connection that is output.
	Stdout io.Reader
	Stderr io.Reader

	config      GRPCServerConfig
	server      *grpc.Server
	broker      *GRPCBroker
	stdioServer *grpcStdioServer

	logger hclog.Logger
}

// ServerProtocol impl.
func (s *GRPCServer) Init() error {
	// Create our server
	var opts []grpc.ServerOption
	if s.TLS != nil {
		opts = append(opts, grpc.Creds(credentials.NewTLS(s.TLS)))
	}
	s.server = s.Server(opts)

	// Register the health service
	healthCheck := health.NewServer()
	healthCheck.SetServingStatus(
		GRPCServiceName, grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(s.server, healthCheck)

	// Register the reflection service
	reflection.Register(s.server)

	// Register the broker service
	brokerServer := newGRPCBrokerServer()
	plugin.RegisterGRPCBrokerServer(s.server, brokerServer)
	s.broker = newGRPCBroker(brokerServer, s.TLS)
	go s.broker.Run()

	// Register the controller
	controllerServer := &grpcControllerServer{server: s}
	plugin.RegisterGRPCControllerServer(s.server, controllerServer)

	// Register the stdio service
	s.stdioServer = newGRPCStdioServer(s.logger, s.Stdout, s.Stderr)
	plugin.RegisterGRPCStdioServer(s.server, s.stdioServer)

	// Register all our plugins onto the gRPC server.
	for k, raw := range s.Plugins {
		p, ok := raw.(GRPCPlugin)
		if !ok {
			return fmt.Errorf("%q is not a GRPC-compatible plugin", k)
		}

		if err := p.GRPCServer(s.broker, s.server); err != nil {
			return fmt.Errorf("error registering %q: %s", k, err)
		}
	}

	return nil
}

// Stop calls Stop on the underlying grpc.Server
func (s *GRPCServer) Stop() {
	s.server.Stop()
}

// GracefulStop calls GracefulStop on the underlying grpc.Server
func (s *GRPCServer) GracefulStop() {
	s.server.GracefulStop()
}

// Config is the GRPCServerConfig encoded as JSON then base64.
func (s *GRPCServer) Config() string {
	// Create a buffer that will contain our final contents
	var buf bytes.Buffer

	// Wrap the base64 encoding with JSON encoding.
	if err := json.NewEncoder(&buf).Encode(s.config); err != nil {
		// We panic since ths shouldn't happen under any scenario. We
		// carefully control the structure being encoded here and it should
		// always be successful.
		panic(err)
	}

	return buf.String()
}

func (s *GRPCServer) Serve(lis net.Listener) {
	defer close(s.DoneCh)
	err := s.server.Serve(lis)
	if err != nil {
		s.logger.Error("grpc server", "error", err)
	}
}

// GRPCServerConfig is the extra configuration passed along for consumers
// to facilitate using GRPC plugins.
type GRPCServerConfig struct {
	StdoutAddr string `json:"stdout_addr"`
	StderrAddr string `json:"stderr_addr"`
}
