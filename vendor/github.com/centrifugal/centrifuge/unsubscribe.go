package centrifuge

import "fmt"

// Unsubscribe describes how client must be unsubscribed (or was unsubscribed)
// from a channel.
// Codes for unsubscribe advices going to client connections must be in range [2000, 2999].
// Unsubscribe codes >= 2500 coming from server to client result into resubscribe attempt.
// Codes [0, 2099] and [2500, 2599] are reserved for Centrifuge library internal use
// and must not be used by applications to create custom Unsubscribe structs.
type Unsubscribe struct {
	// Code is unsubscribe code. Several unsubscribe codes already used by
	// a library, see for example UnsubscribeCodeClient, UnsubscribeCodeDisconnect,
	// UnsubscribeCodeServer, UnsubscribeCodeInsufficient. In theory, we can also
	// allow applications to set their custom unsubscribe codes in the future.
	Code uint32 `json:"code"`
	// Reason is a short description of unsubscribe code for humans. Suitable for
	// logs for better connection behavior observability.
	Reason string `json:"reason,omitempty"`
}

// String representation.
func (d Unsubscribe) String() string {
	return fmt.Sprintf("code: %d, reason: %s", d.Code, d.Reason)
}

var (
	unsubscribeClient = Unsubscribe{
		Code:   UnsubscribeCodeClient,
		Reason: "client unsubscribed",
	}
	unsubscribeDisconnect = Unsubscribe{
		Code:   UnsubscribeCodeDisconnect,
		Reason: "client disconnected",
	}
	unsubscribeServer = Unsubscribe{
		Code:   UnsubscribeCodeServer,
		Reason: "server unsubscribe",
	}
	unsubscribeInsufficientState = Unsubscribe{
		Code:   UnsubscribeCodeInsufficient,
		Reason: "insufficient state",
	}
	unsubscribeExpired = Unsubscribe{
		Code:   UnsubscribeCodeExpired,
		Reason: "subscription expired",
	}
)

// Known unsubscribe codes.
const (
	// UnsubscribeCodeClient set when unsubscribe event was initiated
	// by an explicit client-side unsubscribe call.
	// Code is less than 2000 since it's never sent to a client connection.
	UnsubscribeCodeClient uint32 = 0
	// UnsubscribeCodeDisconnect set when unsubscribe event was initiated
	// by a client disconnect process.
	// Code is less than 2000 since it's never sent to a client connection.
	UnsubscribeCodeDisconnect uint32 = 1
	// UnsubscribeCodeServer set when unsubscribe event was initiated
	// by an explicit server-side unsubscribe call.
	UnsubscribeCodeServer uint32 = 2000
	// UnsubscribeCodeInsufficient set when client unsubscribed from
	// a channel due to insufficient state in a stream. We expect client to
	// resubscribe after receiving this since it's still may be possible to
	// recover a state since known StreamPosition.
	UnsubscribeCodeInsufficient uint32 = 2500
	// UnsubscribeCodeExpired set when client subscription expired.
	UnsubscribeCodeExpired uint32 = 2501
)
