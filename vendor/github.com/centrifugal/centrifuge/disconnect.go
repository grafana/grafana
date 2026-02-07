package centrifuge

import (
	"fmt"
)

// Disconnect allows configuring how client will be disconnected from a server.
// A server can provide a Disconnect.Code and Disconnect.Reason to a client. Clients
// can execute some custom logic based on a certain Disconnect.Code. Code is also
// used for metric collection. Disconnect.Reason is optional and exists mostly for
// human-readable description of returned code – i.e. for logging, debugging etc.
//
// The important note is that Disconnect.Reason must be less than 127 bytes
// due to WebSocket protocol limitations.
//
// Codes have some rules which should be followed by a client connector implementation.
// These rules described below.
//
// Codes in range 0-2999 should not be used by a Centrifuge library user. Those are
// reserved for the client-side and transport specific needs. Codes in range >=5000
// should not be used also. Those are reserved by Centrifuge.
//
// Client should reconnect upon receiving code in range 3000-3499, 4000-4499, >=5000.
// For codes <3000 reconnect behavior can be adjusted for specific transport.
//
// Codes in range 3500-3999 and 4500-4999 are application terminal codes, no automatic
// reconnect should be made by a client implementation.
//
// Library users supposed to use codes in range 4000-4999 for creating custom
// disconnects.
type Disconnect struct {
	// Code is a disconnect code.
	Code uint32 `json:"code,omitempty"`
	// Reason is a short description of disconnect code for humans.
	Reason string `json:"reason"`
}

// String representation.
func (d Disconnect) String() string {
	return fmt.Sprintf("code: %d, reason: %s", d.Code, d.Reason)
}

// Error to use Disconnect as a callback handler error to signal Centrifuge
// that client must be disconnected with corresponding Code and Reason.
func (d Disconnect) Error() string {
	return d.String()
}

// DisconnectConnectionClosed is a special Disconnect object used when
// client connection was closed without any advice from a server side.
// This can be a clean disconnect, or temporary disconnect of the client
// due to internet connection loss. Server can not distinguish the actual
// reason of disconnect.
var DisconnectConnectionClosed = Disconnect{
	Code:   3000,
	Reason: "connection closed",
}

// Some predefined non-terminal disconnect structures used by
// the library internally.
var (
	// DisconnectShutdown issued when node is going to shut down.
	DisconnectShutdown = Disconnect{
		Code:   3001,
		Reason: "shutdown",
	}
	// DisconnectServerError issued when internal error occurred on server.
	DisconnectServerError = Disconnect{
		Code:   3004,
		Reason: "internal server error",
	}
	// DisconnectExpired issued when client connection expired.
	DisconnectExpired = Disconnect{
		Code:   3005,
		Reason: "connection expired",
	}
	// DisconnectSubExpired issued when client subscription expired.
	DisconnectSubExpired = Disconnect{
		Code:   3006,
		Reason: "subscription expired",
	}
	// DisconnectSlow issued when client can't read messages fast enough.
	DisconnectSlow = Disconnect{
		Code:   3008,
		Reason: "slow",
	}
	// DisconnectWriteError issued when an error occurred while writing to
	// client connection.
	DisconnectWriteError = Disconnect{
		Code:   3009,
		Reason: "write error",
	}
	// DisconnectInsufficientState issued when server detects wrong client
	// position in channel Publication stream. Disconnect allows client
	// to restore missed publications on reconnect.
	DisconnectInsufficientState = Disconnect{
		Code:   3010,
		Reason: "insufficient state",
	}
	// DisconnectForceReconnect issued when server disconnects connection.
	DisconnectForceReconnect = Disconnect{
		Code:   3011,
		Reason: "force reconnect",
	}
	// DisconnectNoPong may be issued when server disconnects bidirectional
	// connection due to no pong received to application-level server-to-client
	// pings in a configured time.
	DisconnectNoPong = Disconnect{
		Code:   3012,
		Reason: "no pong",
	}
	// DisconnectTooManyRequests may be issued when client sends too many commands to a server.
	DisconnectTooManyRequests = Disconnect{
		Code:   3013,
		Reason: "too many requests",
	}
)

// The codes below are built-in terminal codes.
var (
	// DisconnectInvalidToken issued when client came with invalid token.
	DisconnectInvalidToken = Disconnect{
		Code:   3500,
		Reason: "invalid token",
	}
	// DisconnectBadRequest issued when client uses malformed protocol frames.
	DisconnectBadRequest = Disconnect{
		Code:   3501,
		Reason: "bad request",
	}
	// DisconnectStale issued to close connection that did not become
	// authenticated in configured interval after dialing.
	DisconnectStale = Disconnect{
		Code:   3502,
		Reason: "stale",
	}
	// DisconnectForceNoReconnect issued when server disconnects connection
	// and asks it to not reconnect again.
	DisconnectForceNoReconnect = Disconnect{
		Code:   3503,
		Reason: "force disconnect",
	}
	// DisconnectConnectionLimit can be issued when client connection exceeds a
	// configured connection limit (per user ID or due to other rule).
	DisconnectConnectionLimit = Disconnect{
		Code:   3504,
		Reason: "connection limit",
	}
	// DisconnectChannelLimit can be issued when client connection exceeds a
	// configured channel limit.
	DisconnectChannelLimit = Disconnect{
		Code:   3505,
		Reason: "channel limit",
	}
	// DisconnectInappropriateProtocol can be issued when client connection format can not
	// handle incoming data. For example, this happens when JSON-based clients receive
	// binary data in a channel. This is usually an indicator of programmer error, JSON
	// clients can not handle binary.
	DisconnectInappropriateProtocol = Disconnect{
		Code:   3506,
		Reason: "inappropriate protocol",
	}
	// DisconnectPermissionDenied may be issued when client attempts accessing a server without
	// enough permissions.
	DisconnectPermissionDenied = Disconnect{
		Code:   3507,
		Reason: "permission denied",
	}
	// DisconnectNotAvailable may be issued when ErrorNotAvailable does not fit message type, for example
	// we issue DisconnectNotAvailable when client sends asynchronous message without MessageHandler set
	// on server side.
	DisconnectNotAvailable = Disconnect{
		Code:   3508,
		Reason: "not available",
	}
	// DisconnectTooManyErrors may be issued when client generates too many errors.
	DisconnectTooManyErrors = Disconnect{
		Code:   3509,
		Reason: "too many errors",
	}
)
