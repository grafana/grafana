package centrifuge

import (
	"context"
	"time"
)

// Publication is a data sent to a channel.
type Publication struct {
	// Offset is an incremental position number inside a history stream.
	// Zero value means that channel does not maintain Publication stream.
	Offset uint64
	// Data published to a channel.
	Data []byte
	// Info is optional information about client connection published this data.
	Info *ClientInfo
	// Tags contains a map with custom key-values attached to a Publication. Tags map
	// will be delivered to a client.
	Tags map[string]string
	// Optional time of publication as Unix timestamp milliseconds. At this point
	// we use it for calculating PUB/SUB time lag, it's not exposed to the client
	// protocol.
	Time int64
	// Channel is only set when subscription channel does not match channel in Publication.
	// This is a case for wildcard subscriptions. Client SDK then should use this channel
	// in PublicationContext.
	Channel string
}

// ClientInfo contains information about client connection.
type ClientInfo struct {
	// ClientID is a client unique id.
	ClientID string
	// UserID is an ID of authenticated user. Zero value means anonymous user.
	UserID string
	// ConnInfo is additional information about connection.
	ConnInfo []byte
	// ChanInfo is additional information about connection in context of
	// channel subscription.
	ChanInfo []byte
}

// BrokerEventHandler can handle messages received from PUB/SUB system.
type BrokerEventHandler interface {
	// HandlePublication to handle received Publications.
	HandlePublication(ch string, pub *Publication, sp StreamPosition, useDelta bool, prevPub *Publication) error
	// HandleJoin to handle received Join messages.
	HandleJoin(ch string, info *ClientInfo) error
	// HandleLeave to handle received Leave messages.
	HandleLeave(ch string, info *ClientInfo) error
	// HandleControl to handle received control data.
	HandleControl(data []byte) error
}

// HistoryFilter allows filtering history according to fields set.
type HistoryFilter struct {
	// Since used to extract publications from stream since provided StreamPosition.
	Since *StreamPosition
	// Limit number of publications to return.
	// -1 means no limit - i.e. return all publications currently in stream.
	// 0 means that caller only interested in current stream top position so
	// Broker should not return any publications.
	Limit int
	// Reverse direction.
	Reverse bool
}

// HistoryOptions define some fields to alter History method behaviour.
type HistoryOptions struct {
	// Filter for history publications.
	Filter HistoryFilter
	// MetaTTL allows overriding default (set in Config.HistoryMetaTTL) history
	// meta information expiration time.
	MetaTTL time.Duration
}

// StreamPosition contains fields to describe position in stream.
// At moment this is used for automatic recovery mechanics. More info about stream
// recovery in Centrifugo docs: https://centrifugal.dev/docs/server/history_and_recovery.
type StreamPosition struct {
	// Offset defines publication incremental offset inside a stream.
	Offset uint64
	// Epoch allows handling situations when storage
	// lost stream entirely for some reason (expired or lost after restart) and we
	// want to track this fact to prevent successful recovery from another stream.
	// I.e. for example we have a stream [1, 2, 3], then it's lost and new stream
	// contains [1, 2, 3, 4], client that recovers from position 3 will only receive
	// publication 4 missing 1, 2, 3 from new stream. With epoch, we can tell client
	// that correct recovery is not possible.
	Epoch string
}

// Closer is an interface that Broker and PresenceManager can optionally implement
// if they need to close any resources on Centrifuge Node graceful shutdown.
type Closer interface {
	// Close when called should clean up used resources.
	Close(ctx context.Context) error
}

// PublishOptions define some fields to alter behaviour of Publish operation.
type PublishOptions struct {
	// HistoryTTL sets history ttl to expire inactive history streams.
	// Current Broker implementations only work with seconds resolution for TTL.
	HistoryTTL time.Duration
	// HistorySize sets history size limit to prevent infinite stream growth.
	HistorySize int
	// HistoryMetaTTL allows overriding default (set in Config.HistoryMetaTTL)
	// history meta information expiration time upon publish.
	HistoryMetaTTL time.Duration
	// ClientInfo to include into Publication. By default, no ClientInfo will be appended.
	ClientInfo *ClientInfo
	// Tags to set Publication.Tags.
	Tags map[string]string
	// IdempotencyKey is an optional key for idempotent publish. Broker implementation
	// may cache these keys for some time to prevent duplicate publications. In this case
	// the returned result is the same as from the previous publication with the same key.
	IdempotencyKey string
	// IdempotentResultTTL sets the time of expiration for results of idempotent publications
	// (publications with idempotency key provided). Memory and Redis engines implement this TTL
	// with second precision, so don't set something less than one second here. By default,
	// Centrifuge uses 5 minutes as idempotent result TTL.
	IdempotentResultTTL time.Duration
	// UseDelta enables using delta encoding for the publication.
	UseDelta bool
}

// Broker is responsible for PUB/SUB mechanics.
type Broker interface {
	// Run called once on start when broker already set to node. At
	// this moment node is ready to process broker events.
	Run(BrokerEventHandler) error

	// Subscribe node on channel to listen all messages coming from channel.
	Subscribe(ch string) error
	// Unsubscribe node from channel to stop listening messages from it.
	Unsubscribe(ch string) error

	// Publish allows sending data into channel. Data should be
	// delivered to all clients subscribed to this channel at moment on any
	// Centrifuge node (with at most once delivery guarantee).
	//
	// Broker can optionally maintain publication history inside channel according
	// to PublishOptions provided. See History method for rules that should be implemented
	// for accessing publications from history stream.
	//
	// Saving message to a history stream and publish to PUB/SUB should be an atomic
	// operation per channel. If this is not true – then publication to one channel
	// must be serialized on the caller side, i.e. publish requests must be issued one
	// after another. Otherwise, the order of publications and stable behaviour of
	// subscribers with positioning/recovery enabled can't be guaranteed.
	//
	// StreamPosition returned here describes stream epoch and offset assigned to
	// the publication. For channels without history this StreamPosition should be
	// zero value.
	// Second bool value returned here means whether Publish was suppressed due to
	// the use of PublishOptions.IdempotencyKey. In this case StreamPosition is
	// returned from the cache maintained by Broker.
	Publish(ch string, data []byte, opts PublishOptions) (StreamPosition, bool, error)
	// PublishJoin publishes Join Push message into channel.
	PublishJoin(ch string, info *ClientInfo) error
	// PublishLeave publishes Leave Push message into channel.
	PublishLeave(ch string, info *ClientInfo) error
	// PublishControl allows sending control command data. If nodeID is empty string
	// then message should be delivered to all running nodes, if nodeID is set then
	// message should be delivered only to node with specified ID.
	PublishControl(data []byte, nodeID, shardKey string) error

	// History used to extract Publications from history stream.
	// Publications returned according to HistoryFilter which allows to set several
	// filtering options. StreamPosition returned describes current history stream
	// top offset and epoch.
	History(ch string, opts HistoryOptions) ([]*Publication, StreamPosition, error)
	// RemoveHistory removes history from channel. This is in general not
	// needed as history expires automatically (based on history_lifetime)
	// but sometimes can be useful for application logic.
	RemoveHistory(ch string) error
}
