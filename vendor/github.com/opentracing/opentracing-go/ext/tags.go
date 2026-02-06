package ext

import "github.com/opentracing/opentracing-go"

// These constants define common tag names recommended for better portability across
// tracing systems and languages/platforms.
//
// The tag names are defined as typed strings, so that in addition to the usual use
//
//     span.setTag(TagName, value)
//
// they also support value type validation via this additional syntax:
//
//    TagName.Set(span, value)
//
var (
	//////////////////////////////////////////////////////////////////////
	// SpanKind (client/server or producer/consumer)
	//////////////////////////////////////////////////////////////////////

	// SpanKind hints at relationship between spans, e.g. client/server
	SpanKind = spanKindTagName("span.kind")

	// SpanKindRPCClient marks a span representing the client-side of an RPC
	// or other remote call
	SpanKindRPCClientEnum = SpanKindEnum("client")
	SpanKindRPCClient     = opentracing.Tag{Key: string(SpanKind), Value: SpanKindRPCClientEnum}

	// SpanKindRPCServer marks a span representing the server-side of an RPC
	// or other remote call
	SpanKindRPCServerEnum = SpanKindEnum("server")
	SpanKindRPCServer     = opentracing.Tag{Key: string(SpanKind), Value: SpanKindRPCServerEnum}

	// SpanKindProducer marks a span representing the producer-side of a
	// message bus
	SpanKindProducerEnum = SpanKindEnum("producer")
	SpanKindProducer     = opentracing.Tag{Key: string(SpanKind), Value: SpanKindProducerEnum}

	// SpanKindConsumer marks a span representing the consumer-side of a
	// message bus
	SpanKindConsumerEnum = SpanKindEnum("consumer")
	SpanKindConsumer     = opentracing.Tag{Key: string(SpanKind), Value: SpanKindConsumerEnum}

	//////////////////////////////////////////////////////////////////////
	// Component name
	//////////////////////////////////////////////////////////////////////

	// Component is a low-cardinality identifier of the module, library,
	// or package that is generating a span.
	Component = StringTagName("component")

	//////////////////////////////////////////////////////////////////////
	// Sampling hint
	//////////////////////////////////////////////////////////////////////

	// SamplingPriority determines the priority of sampling this Span.
	SamplingPriority = Uint16TagName("sampling.priority")

	//////////////////////////////////////////////////////////////////////
	// Peer tags. These tags can be emitted by either client-side or
	// server-side to describe the other side/service in a peer-to-peer
	// communications, like an RPC call.
	//////////////////////////////////////////////////////////////////////

	// PeerService records the service name of the peer.
	PeerService = StringTagName("peer.service")

	// PeerAddress records the address name of the peer. This may be a "ip:port",
	// a bare "hostname", a FQDN or even a database DSN substring
	// like "mysql://username@127.0.0.1:3306/dbname"
	PeerAddress = StringTagName("peer.address")

	// PeerHostname records the host name of the peer
	PeerHostname = StringTagName("peer.hostname")

	// PeerHostIPv4 records IP v4 host address of the peer
	PeerHostIPv4 = IPv4TagName("peer.ipv4")

	// PeerHostIPv6 records IP v6 host address of the peer
	PeerHostIPv6 = StringTagName("peer.ipv6")

	// PeerPort records port number of the peer
	PeerPort = Uint16TagName("peer.port")

	//////////////////////////////////////////////////////////////////////
	// HTTP Tags
	//////////////////////////////////////////////////////////////////////

	// HTTPUrl should be the URL of the request being handled in this segment
	// of the trace, in standard URI format. The protocol is optional.
	HTTPUrl = StringTagName("http.url")

	// HTTPMethod is the HTTP method of the request, and is case-insensitive.
	HTTPMethod = StringTagName("http.method")

	// HTTPStatusCode is the numeric HTTP status code (200, 404, etc) of the
	// HTTP response.
	HTTPStatusCode = Uint16TagName("http.status_code")

	//////////////////////////////////////////////////////////////////////
	// DB Tags
	//////////////////////////////////////////////////////////////////////

	// DBInstance is database instance name.
	DBInstance = StringTagName("db.instance")

	// DBStatement is a database statement for the given database type.
	// It can be a query or a prepared statement (i.e., before substitution).
	DBStatement = StringTagName("db.statement")

	// DBType is a database type. For any SQL database, "sql".
	// For others, the lower-case database category, e.g. "redis"
	DBType = StringTagName("db.type")

	// DBUser is a username for accessing database.
	DBUser = StringTagName("db.user")

	//////////////////////////////////////////////////////////////////////
	// Message Bus Tag
	//////////////////////////////////////////////////////////////////////

	// MessageBusDestination is an address at which messages can be exchanged
	MessageBusDestination = StringTagName("message_bus.destination")

	//////////////////////////////////////////////////////////////////////
	// Error Tag
	//////////////////////////////////////////////////////////////////////

	// Error indicates that operation represented by the span resulted in an error.
	Error = BoolTagName("error")
)

// ---

// SpanKindEnum represents common span types
type SpanKindEnum string

type spanKindTagName string

// Set adds a string tag to the `span`
func (tag spanKindTagName) Set(span opentracing.Span, value SpanKindEnum) {
	span.SetTag(string(tag), value)
}

type rpcServerOption struct {
	clientContext opentracing.SpanContext
}

func (r rpcServerOption) Apply(o *opentracing.StartSpanOptions) {
	if r.clientContext != nil {
		opentracing.ChildOf(r.clientContext).Apply(o)
	}
	SpanKindRPCServer.Apply(o)
}

// RPCServerOption returns a StartSpanOption appropriate for an RPC server span
// with `client` representing the metadata for the remote peer Span if available.
// In case client == nil, due to the client not being instrumented, this RPC
// server span will be a root span.
func RPCServerOption(client opentracing.SpanContext) opentracing.StartSpanOption {
	return rpcServerOption{client}
}

// ---

// StringTagName is a common tag name to be set to a string value
type StringTagName string

// Set adds a string tag to the `span`
func (tag StringTagName) Set(span opentracing.Span, value string) {
	span.SetTag(string(tag), value)
}

// ---

// Uint32TagName is a common tag name to be set to a uint32 value
type Uint32TagName string

// Set adds a uint32 tag to the `span`
func (tag Uint32TagName) Set(span opentracing.Span, value uint32) {
	span.SetTag(string(tag), value)
}

// ---

// Uint16TagName is a common tag name to be set to a uint16 value
type Uint16TagName string

// Set adds a uint16 tag to the `span`
func (tag Uint16TagName) Set(span opentracing.Span, value uint16) {
	span.SetTag(string(tag), value)
}

// ---

// BoolTagName is a common tag name to be set to a bool value
type BoolTagName string

// Set adds a bool tag to the `span`
func (tag BoolTagName) Set(span opentracing.Span, value bool) {
	span.SetTag(string(tag), value)
}

// IPv4TagName is a common tag name to be set to an ipv4 value
type IPv4TagName string

// Set adds IP v4 host address of the peer as an uint32 value to the `span`, keep this for backward and zipkin compatibility
func (tag IPv4TagName) Set(span opentracing.Span, value uint32) {
	span.SetTag(string(tag), value)
}

// SetString records IP v4 host address of the peer as a .-separated tuple to the `span`. E.g., "127.0.0.1"
func (tag IPv4TagName) SetString(span opentracing.Span, value string) {
	span.SetTag(string(tag), value)
}
