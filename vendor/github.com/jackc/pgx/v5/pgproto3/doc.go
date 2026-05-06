// Package pgproto3 is an encoder and decoder of the PostgreSQL wire protocol version 3.
//
// The primary interfaces are Frontend and Backend. They correspond to a client and server respectively. Messages are
// sent with Send (or a specialized Send variant). Messages are automatically buffered to minimize small writes. Call
// Flush to ensure a message has actually been sent.
//
// The Trace method of Frontend and Backend can be used to examine the wire-level message traffic. It outputs in a
// similar format to the PQtrace function in libpq.
//
// See https://www.postgresql.org/docs/current/protocol-message-formats.html for meanings of the different messages.
package pgproto3
