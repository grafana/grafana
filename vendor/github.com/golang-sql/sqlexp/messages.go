package sqlexp

import (
	"context"
	"fmt"
)

// RawMessage is returned from RowsMessage.
type RawMessage interface{}

// ReturnMessage may be passed into a Query argument.
//
// Drivers must implement driver.NamedValueChecker,
// call ReturnMessageInit on it, save it internally,
// and return driver.ErrOmitArgument to prevent
// this from appearing in the query arguments.
//
// Queries that recieve this message should also not return
// SQL errors from the Query method, but wait to return
// it in a Message.
type ReturnMessage struct {
	queue chan RawMessage
}

// Message is called by clients after Query to dequeue messages.
func (m *ReturnMessage) Message(ctx context.Context) RawMessage {
	select {
	case <-ctx.Done():
		return MsgNextResultSet{}
	case raw := <-m.queue:
		return raw
	}
}

// ReturnMessageEnqueue is called by the driver to enqueue the driver.
// Drivers should not call this until after it returns from Query.
func ReturnMessageEnqueue(ctx context.Context, m *ReturnMessage, raw RawMessage) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case m.queue <- raw:
		return nil
	}
}

// ReturnMessageInit is called by database/sql setup the ReturnMessage internals.
func ReturnMessageInit(m *ReturnMessage) {
	m.queue = make(chan RawMessage, 15)
}

type (
	// MsgNextResultSet must be checked for. When received, NextResultSet
	// should be called and if false the message loop should be exited.
	MsgNextResultSet struct{}

	// MsgNext indicates the result set ready to be scanned.
	// This message will often be followed with:
	//
	//	for rows.Next() {
	//		rows.Scan(&v)
	//	}
	MsgNext struct{}

	// MsgRowsAffected returns the number of rows affected.
	// Not all operations that affect rows return results, thus this message
	// may be received multiple times.
	MsgRowsAffected struct{ Count int64 }

	// MsgLastInsertID returns the value of last inserted row. For many
	// database systems and tables this will return int64. Some databases
	// may return a string or GUID equivalent.
	MsgLastInsertID struct{ Value interface{} }

	// MsgNotice is raised from the SQL text and is only informational.
	MsgNotice struct{ Message fmt.Stringer }

	// MsgError returns SQL errors from the database system (not transport
	// or other system level errors).
	MsgError struct{ Error error }
)
