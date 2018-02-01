package plugin

import (
	"fmt"

	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// newGRPCClient creates a new GRPCClient. The Client argument is expected
// to be successfully started already with a lock held.
func newGRPCClient(c *Client) (*GRPCClient, error) {
	// Build dialing options.
	opts := make([]grpc.DialOption, 0, 5)

	// We use a custom dialer so that we can connect over unix domain sockets
	opts = append(opts, grpc.WithDialer(c.dialer))

	// go-plugin expects to block the connection
	opts = append(opts, grpc.WithBlock())

	// Fail right away
	opts = append(opts, grpc.FailOnNonTempDialError(true))

	// If we have no TLS configuration set, we need to explicitly tell grpc
	// that we're connecting with an insecure connection.
	if c.config.TLSConfig == nil {
		opts = append(opts, grpc.WithInsecure())
	} else {
		opts = append(opts, grpc.WithTransportCredentials(
			credentials.NewTLS(c.config.TLSConfig)))
	}

	// Connect. Note the first parameter is unused because we use a custom
	// dialer that has the state to see the address.
	conn, err := grpc.Dial("unused", opts...)
	if err != nil {
		return nil, err
	}

	return &GRPCClient{
		Conn:    conn,
		Plugins: c.config.Plugins,
	}, nil
}

// GRPCClient connects to a GRPCServer over gRPC to dispense plugin types.
type GRPCClient struct {
	Conn    *grpc.ClientConn
	Plugins map[string]Plugin
}

// ClientProtocol impl.
func (c *GRPCClient) Close() error {
	return c.Conn.Close()
}

// ClientProtocol impl.
func (c *GRPCClient) Dispense(name string) (interface{}, error) {
	raw, ok := c.Plugins[name]
	if !ok {
		return nil, fmt.Errorf("unknown plugin type: %s", name)
	}

	p, ok := raw.(GRPCPlugin)
	if !ok {
		return nil, fmt.Errorf("plugin %q doesn't support gRPC", name)
	}

	return p.GRPCClient(c.Conn)
}

// ClientProtocol impl.
func (c *GRPCClient) Ping() error {
	client := grpc_health_v1.NewHealthClient(c.Conn)
	_, err := client.Check(context.Background(), &grpc_health_v1.HealthCheckRequest{
		Service: GRPCServiceName,
	})

	return err
}
