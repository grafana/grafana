package pgproto3

import (
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/internal/pgio"
)

// maxMessageBodyLen is the maximum length of a message body in bytes. See PG_LARGE_MESSAGE_LIMIT in the PostgreSQL
// source. It is defined as (MaxAllocSize - 1). MaxAllocSize is defined as 0x3fffffff.
const maxMessageBodyLen = (0x3fffffff - 1)

// Message is the interface implemented by an object that can decode and encode
// a particular PostgreSQL message.
type Message interface {
	// Decode is allowed and expected to retain a reference to data after
	// returning (unlike encoding.BinaryUnmarshaler).
	Decode(data []byte) error

	// Encode appends itself to dst and returns the new buffer.
	Encode(dst []byte) ([]byte, error)
}

// FrontendMessage is a message sent by the frontend (i.e. the client).
type FrontendMessage interface {
	Message
	Frontend() // no-op method to distinguish frontend from backend methods
}

// BackendMessage is a message sent by the backend (i.e. the server).
type BackendMessage interface {
	Message
	Backend() // no-op method to distinguish frontend from backend methods
}

type AuthenticationResponseMessage interface {
	BackendMessage
	AuthenticationResponse() // no-op method to distinguish authentication responses
}

type invalidMessageLenErr struct {
	messageType string
	expectedLen int
	actualLen   int
}

func (e *invalidMessageLenErr) Error() string {
	return fmt.Sprintf("%s body must have length of %d, but it is %d", e.messageType, e.expectedLen, e.actualLen)
}

type invalidMessageFormatErr struct {
	messageType string
	details     string
}

func (e *invalidMessageFormatErr) Error() string {
	return fmt.Sprintf("%s body is invalid %s", e.messageType, e.details)
}

type writeError struct {
	err         error
	safeToRetry bool
}

func (e *writeError) Error() string {
	return fmt.Sprintf("write failed: %s", e.err.Error())
}

func (e *writeError) SafeToRetry() bool {
	return e.safeToRetry
}

func (e *writeError) Unwrap() error {
	return e.err
}

type ExceededMaxBodyLenErr struct {
	MaxExpectedBodyLen int
	ActualBodyLen      int
}

func (e *ExceededMaxBodyLenErr) Error() string {
	return fmt.Sprintf("invalid body length: expected at most %d, but got %d", e.MaxExpectedBodyLen, e.ActualBodyLen)
}

// getValueFromJSON gets the value from a protocol message representation in JSON.
func getValueFromJSON(v map[string]string) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	if text, ok := v["text"]; ok {
		return []byte(text), nil
	}
	if binary, ok := v["binary"]; ok {
		return hex.DecodeString(binary)
	}
	return nil, errors.New("unknown protocol representation")
}

// beginMessage begins a new message of type t. It appends the message type and a placeholder for the message length to
// dst. It returns the new buffer and the position of the message length placeholder.
func beginMessage(dst []byte, t byte) ([]byte, int) {
	dst = append(dst, t)
	sp := len(dst)
	dst = pgio.AppendInt32(dst, -1)
	return dst, sp
}

// finishMessage finishes a message that was started with beginMessage. It computes the message length and writes it to
// dst[sp]. If the message length is too large it returns an error. Otherwise it returns the final message buffer.
func finishMessage(dst []byte, sp int) ([]byte, error) {
	messageBodyLen := len(dst[sp:])
	if messageBodyLen > maxMessageBodyLen {
		return nil, errors.New("message body too large")
	}
	pgio.SetInt32(dst[sp:], int32(messageBodyLen))
	return dst, nil
}
