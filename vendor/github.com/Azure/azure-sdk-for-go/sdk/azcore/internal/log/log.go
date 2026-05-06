//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// This is an internal helper package to combine the complete logging APIs.
package log

import (
	azlog "github.com/Azure/azure-sdk-for-go/sdk/azcore/log"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

type Event = log.Event

const (
	EventRequest       = azlog.EventRequest
	EventResponse      = azlog.EventResponse
	EventResponseError = azlog.EventResponseError
	EventRetryPolicy   = azlog.EventRetryPolicy
	EventLRO           = azlog.EventLRO
)

// Write invokes the underlying listener with the specified event and message.
// If the event shouldn't be logged or there is no listener then Write does nothing.
func Write(cls log.Event, msg string) {
	log.Write(cls, msg)
}

// Writef invokes the underlying listener with the specified event and formatted message.
// If the event shouldn't be logged or there is no listener then Writef does nothing.
func Writef(cls log.Event, format string, a ...any) {
	log.Writef(cls, format, a...)
}

// SetListener will set the Logger to write to the specified listener.
func SetListener(lst func(Event, string)) {
	log.SetListener(lst)
}

// Should returns true if the specified log event should be written to the log.
// By default all log events will be logged.  Call SetEvents() to limit
// the log events for logging.
// If no listener has been set this will return false.
// Calling this method is useful when the message to log is computationally expensive
// and you want to avoid the overhead if its log event is not enabled.
func Should(cls log.Event) bool {
	return log.Should(cls)
}
