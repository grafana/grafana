package logsink

import (
	"sync/atomic"
	"unsafe"
)

func fatalMessageStore(e savedEntry) {
	// Only put a new one in if we haven't assigned before.
	atomic.CompareAndSwapPointer(&fatalMessage, nil, unsafe.Pointer(&e))
}

var fatalMessage unsafe.Pointer // savedEntry stored with CompareAndSwapPointer

// FatalMessage returns the Meta and message contents of the first message
// logged with Fatal severity, or false if none has occurred.
func FatalMessage() (*Meta, []byte, bool) {
	e := (*savedEntry)(atomic.LoadPointer(&fatalMessage))
	if e == nil {
		return nil, nil, false
	}
	return e.meta, e.msg, true
}

// DoNotUseRacyFatalMessage is FatalMessage, but worse.
//
//go:norace
//go:nosplit
func DoNotUseRacyFatalMessage() (*Meta, []byte, bool) {
	e := (*savedEntry)(fatalMessage)
	if e == nil {
		return nil, nil, false
	}
	return e.meta, e.msg, true
}
