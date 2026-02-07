package centrifuge

// PresenceStats represents a short presence information for channel.
type PresenceStats struct {
	// NumClients is a number of client connections in channel.
	NumClients int
	// NumUsers is a number of unique users in channel.
	NumUsers int
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
	// for connection with specified identifier. PresenceManager should
	// have a property to expire client information that was not updated
	// (touched) after some configured time interval.
	AddPresence(ch string, clientID string, info *ClientInfo) error
	// RemovePresence removes presence information for connection
	// with specified client and user identifiers.
	RemovePresence(ch string, clientID string, userID string) error
}
