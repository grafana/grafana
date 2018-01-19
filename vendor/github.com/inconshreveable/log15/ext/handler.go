package ext

import (
	"os"
	"sync"
	"sync/atomic"
	"unsafe"

	log "github.com/inconshreveable/log15"
)

// EscalateErrHandler wraps another handler and passes all records through
// unchanged except if the logged context contains a non-nil error
// value in its context. In that case, the record's level is raised
// to LvlError unless it was already more serious (LvlCrit).
//
// This allows you to log the result of all functions for debugging
// and still capture error conditions when in production with a single
// log line. As an example, the following the log record will be written
// out only if there was an error writing a value to redis:
//
//     logger := logext.EscalateErrHandler(
//         log.LvlFilterHandler(log.LvlInfo, log.StdoutHandler))
//
//     reply, err := redisConn.Do("SET", "foo", "bar")
//     logger.Debug("Wrote value to redis", "reply", reply, "err", err)
//     if err != nil {
//         return err
//     }
//
func EscalateErrHandler(h log.Handler) log.Handler {
	return log.FuncHandler(func(r *log.Record) error {
		if r.Lvl > log.LvlError {
			for i := 1; i < len(r.Ctx); i++ {
				if v, ok := r.Ctx[i].(error); ok && v != nil {
					r.Lvl = log.LvlError
					break
				}
			}
		}
		return h.Log(r)
	})
}

// SpeculativeHandler is a handler for speculative logging. It
// keeps a ring buffer of the given size full of the last events
// logged into it. When Flush is called, all buffered log records
// are written to the wrapped handler. This is extremely for
// continuosly capturing debug level output, but only flushing those
// log records if an exceptional condition is encountered.
func SpeculativeHandler(size int, h log.Handler) *Speculative {
	return &Speculative{
		handler: h,
		recs:    make([]*log.Record, size),
	}
}

// Speculative is the Log15.Handler. Read `SpeculativeHandler` for more information.
type Speculative struct {
	mu      sync.Mutex
	idx     int
	recs    []*log.Record
	handler log.Handler
	full    bool
}

// Log implements log15.Handler interface
func (h *Speculative) Log(r *log.Record) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.recs[h.idx] = r
	h.idx = (h.idx + 1) % len(h.recs)
	h.full = h.full || h.idx == 0
	return nil
}

// Flush logs all records on the handler.
func (h *Speculative) Flush() {
	recs := make([]*log.Record, 0)
	func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if h.full {
			recs = append(recs, h.recs[h.idx:]...)
		}
		recs = append(recs, h.recs[:h.idx]...)

		// reset state
		h.full = false
		h.idx = 0
	}()

	// don't hold the lock while we flush to the wrapped handler
	for _, r := range recs {
		h.handler.Log(r)
	}
}

// HotSwapHandler wraps another handler that may swapped out
// dynamically at runtime in a thread-safe fashion.
// HotSwapHandler is the same functionality
// used to implement the SetHandler method for the default
// implementation of Logger.
func HotSwapHandler(h log.Handler) *HotSwap {
	hs := new(HotSwap)
	hs.Swap(h)
	return hs
}

// HotSwap is the Log15.Handler. Read `HotSwapHandler` for more information.
type HotSwap struct {
	handler unsafe.Pointer
}

// Log implements log15.Handler interface.
func (h *HotSwap) Log(r *log.Record) error {
	return (*(*log.Handler)(atomic.LoadPointer(&h.handler))).Log(r)
}

// Swap atomically the logger handler.
func (h *HotSwap) Swap(newHandler log.Handler) {
	atomic.StorePointer(&h.handler, unsafe.Pointer(&newHandler))
}

// FatalHandler makes critical errors exit the program
// immediately, much like the log.Fatal* methods from the
// standard log package
func FatalHandler(h log.Handler) log.Handler {
	return log.FuncHandler(func(r *log.Record) error {
		err := h.Log(r)
		if r.Lvl == log.LvlCrit {
			os.Exit(1)
		}
		return err
	})
}
