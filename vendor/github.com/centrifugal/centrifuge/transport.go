package centrifuge

import "github.com/centrifugal/protocol"

// ProtocolType represents client connection transport encoding format.
type ProtocolType string

func (t ProtocolType) toProto() protocol.Type {
	return protocol.Type(t)
}

const (
	// ProtocolTypeJSON means JSON protocol - i.e. data encoded in
	// JSON-streaming format.
	ProtocolTypeJSON ProtocolType = "json"
	// ProtocolTypeProtobuf means protobuf protocol - i.e. data encoded
	// as length-delimited protobuf messages.
	ProtocolTypeProtobuf ProtocolType = "protobuf"
)

// EncodingType represents client payload encoding format.
type EncodingType string

const (
	// EncodingTypeJSON means JSON payload.
	EncodingTypeJSON EncodingType = "json"
	// EncodingTypeBinary means binary payload.
	EncodingTypeBinary EncodingType = "binary"
)

// TransportInfo has read-only transport description methods.
type TransportInfo interface {
	// Name returns a name of transport used for client connection.
	Name() string
	// Protocol returns underlying transport protocol type used.
	// At moment this can be for example a JSON streaming based protocol
	// or Protobuf length-delimited protocol.
	Protocol() ProtocolType
	// Encoding returns payload encoding type used by client. By default
	// server assumes that payload passed as JSON.
	Encoding() EncodingType
}

// Transport abstracts a connection transport between server and client.
// It does not contain Read method as reading can be handled by connection
// handler code (for example by WebsocketHandler.ServeHTTP).
type Transport interface {
	TransportInfo
	// Write data encoded using Centrifuge protocol to connection.
	Write([]byte) error
	// Close closes transport.
	Close(*Disconnect) error
}
