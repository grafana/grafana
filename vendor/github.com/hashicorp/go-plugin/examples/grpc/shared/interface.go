// Package shared contains shared data between the host and plugins.
package shared

import (
	"net/rpc"

	"google.golang.org/grpc"

	"github.com/hashicorp/go-plugin"
	"github.com/hashicorp/go-plugin/examples/grpc/proto"
)

// Handshake is a common handshake that is shared by plugin and host.
var Handshake = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "BASIC_PLUGIN",
	MagicCookieValue: "hello",
}

// PluginMap is the map of plugins we can dispense.
var PluginMap = map[string]plugin.Plugin{
	"kv": &KVPlugin{},
}

// KV is the interface that we're exposing as a plugin.
type KV interface {
	Put(key string, value []byte) error
	Get(key string) ([]byte, error)
}

// This is the implementation of plugin.Plugin so we can serve/consume this.
// We also implement GRPCPlugin so that this plugin can be served over
// gRPC.
type KVPlugin struct {
	// Concrete implementation, written in Go. This is only used for plugins
	// that are written in Go.
	Impl KV
}

func (p *KVPlugin) Server(*plugin.MuxBroker) (interface{}, error) {
	return &RPCServer{Impl: p.Impl}, nil
}

func (*KVPlugin) Client(b *plugin.MuxBroker, c *rpc.Client) (interface{}, error) {
	return &RPCClient{client: c}, nil
}

func (p *KVPlugin) GRPCServer(s *grpc.Server) error {
	proto.RegisterKVServer(s, &GRPCServer{Impl: p.Impl})
	return nil
}

func (p *KVPlugin) GRPCClient(c *grpc.ClientConn) (interface{}, error) {
	return &GRPCClient{client: proto.NewKVClient(c)}, nil
}
