package centrifuge

import (
	"context"
	"time"
)

// Publication is a data sent to channel.
type Publication struct {
	// Offset is an incremental position number inside history stream.
	// Zero value means that channel does not maintain Publication stream.
	Offset uint64
	// Data published to channel.
	Data []byte
	// Info is an optional information about client connection published this data.
	Info *ClientInfo
}

// ClientInfo contains information about client connection.
type ClientInfo struct {
	// ClientID is a client unique id.
	ClientID string
	// UserID is an ID of authenticated user. Zero value means anonymous user.
	UserID string
	// ConnInfo is an additional information about connection.
	ConnInfo []byte
	// ChanInfo is an additional information about connection in context of
	// channel subscription.
	ChanInfo []byte
}

// PresenceStats represents a short presence information for channel.
type PresenceStats struct {
	// NumClients is a number of client connections in channel.
	NumClients int
	// NumUsers is a number of unique users in channel.
	NumUsers int
}

// BrokerEventHandler can handle messages received from PUB/SUB system.
type BrokerEventHandler interface {
	// HandlePublication to handle received Publications.
	HandlePublication(ch string, pub *Publication) error
	// HandleJoin to handle received Join messages.
	HandleJoin(ch string, info *ClientInfo) error
	// HandleLeave to handle received Leave messages.
	HandleLeave(ch string, info *ClientInfo) error
	// HandleControl to handle received control data.
	HandleControl(data []byte) error
}

// HistoryFilter allows to filter history according to fields set.
type HistoryFilter struct {
	// Since used to extract publications from stream since provided StreamPosition.
	Since *StreamPosition
	// Limit number of publications to return.
	// -1 means no limit - i.e. return all publications currently in stream.
	// 0 means that caller only interested in current stream top position so
	// Engine should not return any publications.
	Limit int
}

// StreamPosition contains fields to describe position in stream.
// At moment this is used for automatic recovery mechanics. More info about stream
// recovery in docs: https://centrifugal.github.io/centrifugo/server/recover/.
type StreamPosition struct {
	// Offset defines publication incremental offset inside a stream.
	Offset uint64
	// Epoch of sequence and generation. Allows to handle situations when storage
	// lost stream entirely for some reason (expired or lost after restart) and we
	// want to track this fact to prevent successful recovery from another stream.
	// I.e. for example we have stream [1, 2, 3], then it's lost and new stream
	// contains [1, 2, 3, 4], client that recovers from position 3 will only receive
	// publication 4 missing 1, 2, 3 from new stream. With epoch we can tell client
	// that correct recovery is not possible.
	Epoch string
}

// Closer is an interface that Broker, HistoryManager and PresenceManager can
// optionally implement if they need to close any resources on Centrifuge node
// shutdown.
type Closer interface {
	// Close when called should clean up used resources.
	Close(ctx context.Context) error
}

// PublishOptions define some fields to alter behaviour of Publish operation.
type PublishOptions struct {
	// HistoryTTL sets history ttl to expire inactive history streams.
	// Current Engine implementations only work with seconds resolution for TTL.
	HistoryTTL time.Duration
	// HistorySize sets history size limit to prevent infinite stream growth.
	HistorySize int
	// ClientInfo to include into Publication. By default no ClientInfo will be appended.
	ClientInfo *ClientInfo
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

	// Publish allows to send data into channel. Data should be
	// delivered to all clients subscribed to this channel at moment on any
	// Centrifuge node (with at most once delivery guarantee).
	//
	// Broker can optionally maintain publication history inside channel according
	// to PublishOptions provided. See History method for rules that should be implemented
	// for accessing Publications from history stream.
	//
	// Saving message to a history stream and publish to PUB/SUB should be an atomic
	// operation per channel.
	//
	// StreamPosition returned here describes current stream top offset and epoch.
	// For channels without history this StreamPosition should be empty.
	Publish(ch string, data []byte, opts PublishOptions) (StreamPosition, error)
	// PublishJoin publishes Join Push message into channel.
	PublishJoin(ch string, info *ClientInfo) error
	// PublishLeave publishes Leave Push message into channel.
	PublishLeave(ch string, info *ClientInfo) error
	// PublishControl allows to send control command data to all running nodes.
	PublishControl(data []byte) error

	// History used to extract Publications from history stream.
	// Publications returned according to HistoryFilter which allows to set several
	// filtering options. StreamPosition returned describes current history stream
	// top offset and epoch.
	History(ch string, filter HistoryFilter) ([]*Publication, StreamPosition, error)
	// RemoveHistory removes history from channel. This is in general not
	// needed as history expires automatically (based on history_lifetime)
	// but sometimes can be useful for application logic.
	RemoveHistory(ch string) error

	// Channels returns slice of currently active channels (with one or more
	// subscribers) on all running nodes. This is possible with Redis but can
	// be much harder in other PUB/SUB system. Anyway this information can only
	// be used for admin needs to better understand state of system. So it's not
	// a big problem if another Broker implementation won't support this method.
	//
	// Deprecated. See https://github.com/centrifugal/centrifuge/issues/147.
	Channels() ([]string, error)
}

// PresenceManager is responsible for channel presence management.
type PresenceManager interface {
	// Presence returns actual presence information for channel.
	Presence(ch string) (map[string]*ClientInfo, error)
	// PresenceStats returns short stats of current presence data
	// suitable for scenarios when caller does not need full client
	// info returned by presence method.
	PresenceStats(ch string) (PresenceStats, error)
	// AddPresence sets or updates presence information in channel
	// for connection with specified identifier. Engine should have a
	// property to expire client information that was not updated
	// (touched) after some configured time interval.
	AddPresence(ch string, clientID string, info *ClientInfo, expire time.Duration) error
	// RemovePresence removes presence information for connection
	// with specified identifier.
	RemovePresence(ch string, clientID string) error
}

// Engine is responsible for PUB/SUB mechanics, channel history and
// presence information.
type Engine interface {
	Broker
	PresenceManager
}
