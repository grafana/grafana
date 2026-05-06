package pipe

import (
	"errors"
	"io"
	"iter"
	"sync"
	"time"

	"github.com/openfga/openfga/internal/bitutil"
)

const (
	// This value is used as the default duration that a send on a
	// pipe will wait before extending the pipe's internal buffer.
	//
	// A negative value disables the pipe extension functionality.
	DefaultExtendAfter time.Duration = -1

	// This value is used as the default value that indicates the maximum
	// number of times that a pipe's internal buffer may be extended.
	//
	// A negative value will allow unlimited extensions.
	DefaultMaxExtensions int = -1
)

var ErrInvalidSize = errors.New("pipe size must be a power of two")

// Rx is an interface that exposes methods for receiving values.
// Any implementation of Rx is intended to be concurrency safe.
type Rx[T any] interface {
	// Recv is a function that provides a "pull" mechanism for reading
	// values from the Rx. Recv overwrites the value of t with the next
	// value read from the Rx and returns `true` only when a new value
	// has been written to t. The implementation of Rx must make it safe
	// to call Recv concurrently.
	//
	// After a call to Recv has returned `false`, all subsequent calls to
	// Recv must also return `false`. Additionally any iter.Seq returned
	// by a call to Seq must also terminate at this point.
	Recv(t *T) bool

	// Seq is a function that provides a way to iterate over values in
	// the Rx. Subsequent calls to Seq on the same Rx must provide a unique
	// iterator that contends for values from the Rx. This means that values
	// are not broadcast to each iter.Seq from the same Rx. No guarantees
	// are made about the order in which an iter.Seq will receive a value.
	//
	// The implementation of Rx must make it safe to call Seq concurrently.
	// Once iteration of any produced iter.Seq has stopped, all other iter.Seq
	// instances produced by the same Rx will terminate.
	Seq() iter.Seq[T]
}

// Tx is an interface that exposes methods for sending values.
// Any implementation of Tx is intended to be concurrency safe.
type Tx[T any] interface {
	// Send is a function that provides a way to send a value through the Tx.
	// When a value has been sent successfully, Send must return a `true` value.
	// When a value has not been sent, for any reason, Send must return a `false`
	// value. The implementation of Tx must make it safe to call Send concurrently.
	//
	// Once Send has returned a `false` value, all subsequent calls to
	// Send must also return a `false` value.
	Send(T) bool
}

// TxCloser is an interface that exposes methods for sending values and
// closing the instance. It is a combination of Tx and io.Closer interfaces.
// Any implementation of TxCloser is intended to be concurrency safe.
//
// Once Close has been called on a TxCloser, all subsequent calls to Send
// must return a `false` value.
type TxCloser[T any] interface {
	Tx[T]
	io.Closer
}

// Pipe is a struct that implements the TxCloser and Rx interfaces.
// A Pipe will buffer sent values up to its capacity. All methods on
// Pipe are concurrency safe.
//
// Once a Pipe's capacity has been reached, subsequent calls to Send
// on the Pipe will block until Recv or Close is called on the Pipe.
//
// When a Pipe's extension configuration is set, its internal buffer
// will be extended when a call to Send blocks for longer than the
// configured threshold. A Pipe's buffer is doubled by each extension
// and may be extended up to the configured maximum number of times.
//
// When a Pipe is empty -- no values are currently buffered --
// subsequent calls to Recv on the Pipe will block until Send or Close
// is called on the Pipe.
//
// Once Close has been called on a Pipe, subsequent calls to Send and
// Recv will return a `false` value. Additionally, all iter.Seq values
// returned by calls to Seq on the Pipe will terminate.
type Pipe[T any] struct {
	// data holds the values that have been sent to a Pipe
	// and are waiting to be received. data is used as a ring
	// buffer.
	//
	// The size of data must be initialized to
	// a power of two. (e.g. 1, 2, 4, 8, 16, 32...)
	data []T

	// condFull is a condition that calls to Send will wait on while
	// a Pipe's ring buffer is filled to capacity.
	condFull *sync.Cond

	// condEmpty is a condition that calls to Recv will wait on while
	// a Pipe's ring buffer is empty.
	condEmpty *sync.Cond

	// head is the write position in a Pipe's internal ring buffer.
	// head is only ever incremented, and is expected to wrap when
	// its value overflows. Wrapping behavior is dependent on the
	// length of data being a power of two.
	head uint

	// tail is the read position in a Pipe's internal ring buffer.
	// tail is only ever incremented, and is expected to wrap when
	// its value overflows. Wrapping behavior is dependent on the
	// length of data being a power of two.
	tail uint

	// mu is a mutex that protects all of a Pipe's internal fields.
	mu sync.Mutex

	// done indicates the status of the Pipe. When done is `true`
	// subsequent calls to Send and Recv must return `false`.
	done bool

	// extendAfter is the duration that a pipe will wait on a send
	// to a full buffer before extending the buffer.
	extendAfter time.Duration

	// extendCount keeps track of the number of times that the pipe's
	// internal buffer has been extended.
	extendCount int

	// maxExtensions indicates the maximum number of times that a pipe's
	// internal buffer may be extended.
	maxExtensions int
}

// New is a function that instantiates a new Pipe with a size of n.
// The value of n must be a valid power of two. Any other value will
// result in an error.
func New[T any](n int) (*Pipe[T], error) {
	if !bitutil.PowerOfTwo(n) {
		return nil, ErrInvalidSize
	}
	var p Pipe[T]
	p.data = make([]T, n)
	p.condFull = sync.NewCond(&p.mu)
	p.condEmpty = sync.NewCond(&p.mu)
	p.extendAfter = DefaultExtendAfter
	p.maxExtensions = DefaultMaxExtensions
	return &p, nil
}

// Must is a function that returns a new instance of a Pipe, or panics
// if an error is encountered.
func Must[T any](n int) *Pipe[T] {
	p, err := New[T](n)
	if err != nil {
		panic(err)
	}
	return p
}

// SetExtensionConfig is a function that sets the configuration for a
// pipe's internal buffer.
//
// When sending a value to a pipe takes longer than the extendAfter
// duration, the pipe's internal buffer will be extended automatically.
// The buffer will be extended up to the maxExtensions value.
//
// The buffer's size doubles after each extension.
//
// A negative extendAfter value will disable dynamic extension.
// A 0 value may be provided for extendAfter to indicate immediate extension.
//
// A negative maxExtensions value will allow unlimited extensions.
func (p *Pipe[T]) SetExtensionConfig(extendAfter time.Duration, maxExtensions int) {
	p.extendAfter = extendAfter
	p.maxExtensions = maxExtensions
}

// extend is a function that conditionally grows the size of the pipe's
// internal buffer. This capability exists to make the pipe a bit more
// elastic in terms of its memory use. If the pipe is closed, or its
// capacity is greater than n, this function will return immediately.
//
// N is expected to be a power of two.
func (p *Pipe[T]) extend(n uint) {
	// If the pipe is closed, no need to extend
	if p.done {
		return
	}

	oldCapacity := uint(len(p.data))

	if oldCapacity >= n {
		return
	}

	// Distance between the head and tail is always the size of the buffer
	currentSize := p.head - p.tail

	newData := make([]T, n)

	// Reorganize the buffer data so that the first element starts at index 0
	for i := range currentSize {
		oldIndex := p.mask(p.tail + i)
		newData[i] = p.data[oldIndex]
	}

	p.data = newData

	// Reset the buffer positions since we just reoganized the data
	p.tail = 0
	p.head = currentSize

	p.extendCount++

	// Wake all senders that were blocked on full buffer
	p.condFull.Broadcast()
}

// Grow is a function that increases the pipe's total capacity, if necessary,
// to guarantee space up to n items. After Grow(n), at least n items can be
// sent to the pipe without another allocation. If n is not a power of two,
// Grow will return an ErrInvalidSize error.
func (p *Pipe[T]) Grow(n int) error {
	if !bitutil.PowerOfTwo(n) {
		return ErrInvalidSize
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	p.extend(uint(n))
	return nil
}

// empty is a function that returns `true` when the Pipe's internal
// ring buffer has no elements waiting to be received. As long as a
// single element is waiting to be received, empty will return `false`.
func (p *Pipe[T]) empty() bool {
	return p.head == p.tail
}

// full is a function that returns `true` when the Pipe's internal
// ring buffer has elements waiting to be received equal to its capacity.
// As long as one open slot exists in the Pipe's ring buffer, full
// will return `false`.
func (p *Pipe[T]) full() bool {
	// The distance between head and tail will always equal the current
	// size of the ring buffer. This holds true even when head has wrapped
	// and tail has not.
	//
	// For example, given head is 2 and tail is (math.MaxUint - 3): the
	// difference between them is 6.
	return (p.head - p.tail) == uint(len(p.data))
}

// mask is a function used to bit mask the read and write position
// values. Since the values are only incremented, mask is used to
// "wrap" their values to the bounds of the ring buffer's capacity.
func (p *Pipe[T]) mask(value uint) uint {
	// The uint length of data is subtracted by one before ANDing the value.
	// Since the length of data is always a power of two, subtracting one from
	// it, as a uint, will turn on all less significant bits.
	//
	// For instance, say the length of data is 8, represented as 1000 in binary.
	// Subtract one from it, and the difference is 0111 in binary, or 7 in decimal
	// form.
	//
	// Then, take value and AND it with the value derived from the length of data.
	// Following the previous example, given that value is 20, represented as
	// 10100 in binary: when 10100 is ANDed with 00111 the result is 00100, or
	// 4 in decimal form.
	//
	// Continuing the example, if the value of head is 20 and the length of data
	// is 8, then mask(head) == 4. This means that the current write position of
	// the ring buffer is index 4 in data.
	return value & (uint(len(p.data)) - 1)
}

// Size is a function used to retrieve the current number of items waiting in the
// pipe's internal buffer to be received.
func (p *Pipe[T]) Size() int {
	p.mu.Lock()
	defer p.mu.Unlock()

	return int(p.head - p.tail)
}

// Capacity is a function used to retrieve the current number of items that the
// pipe's internal buffer can hold.
func (p *Pipe[T]) Capacity() int {
	p.mu.Lock()
	defer p.mu.Unlock()

	return len(p.data)
}

// Seq is a function that returns an iter.Seq instance that allows the caller to
// iterate over the values received from the Pipe. When a caller terminates iteration
// of a returned iter.Seq, all other iter.Seq values returned from the same Pipe
// will terminate.
func (p *Pipe[T]) Seq() iter.Seq[T] {
	return func(yield func(T) bool) {
		// The Pipe is closed once any of the active iter.Seq value has
		// terminated its iteration.
		defer p.Close()

		for {
			var msg T
			ok := p.Recv(&msg)
			if !ok {
				break
			}

			if !yield(msg) {
				break
			}
		}
	}
}

// Send is a function that sends values to the Pipe. Send returns `true` when the
// value was successfully accepted by the Pipe and stored in its internal buffer.
// Send returns `false` when the Pipe has been closed. Once Send has returned a
// `false` value, all subsequent calls to Send on the same Pipe will return `false`.
//
// When a Pipe's internal buffer has filled to capacity, calls to Send will block
// until a call to Recv or Close is made on the same Pipe.
func (p *Pipe[T]) Send(item T) bool {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.done {
		return false
	}

	// Wait if the buffer is full and the pipe is not yet done.
	for p.full() && !p.done {
		var timer *time.Timer

		if p.extendAfter >= 0 && (p.maxExtensions < 0 || p.extendCount < p.maxExtensions) {
			currentSize := len(p.data)
			timer = time.AfterFunc(p.extendAfter, func() {
				p.mu.Lock()
				defer p.mu.Unlock()

				if len(p.data) != currentSize {
					return
				}

				// Ensure that the extension limit hasn't been reached
				if p.maxExtensions >= 0 && p.extendCount >= p.maxExtensions {
					return
				}
				p.extend(uint(currentSize) << 1)
			})
		}

		p.condFull.Wait()

		if timer != nil {
			timer.Stop()
		}
	}

	if p.done {
		return false
	}

	p.data[p.mask(p.head)] = item
	p.head++

	// Signal that the buffer is no longer empty to wake one waiter.
	p.condEmpty.Signal()
	return true
}

// Recv is a function that receives values from a Pipe. Recv returns `true` when the
// value of t was successfully overwritten. Recv returns `false` when the Pipe has been
// closed. Once Recv has returned a `false` value, all subsequent calls to Recv on the
// same Pipe will return `false`.
//
// When a Pipe's internal buffer is empty, calls to Recv will block until a call to Send
// or Close is made on the same Pipe.
func (p *Pipe[T]) Recv(t *T) bool {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Wait while the buffer is empty and the pipe is not yet done.
	for p.empty() && !p.done {
		p.condEmpty.Wait()
	}

	if p.empty() && p.done {
		p.data = nil
		return false
	}

	*t = p.data[p.mask(p.tail)]
	p.tail++

	// Signal that the buffer is no longer full to wake one waiter.
	p.condFull.Signal()
	return true
}

// Close is a function that stops the Pipe from sending or receiving values. Once Close
// has been called on a Pipe, all subsequent calls to Send and Recv on that Pipe will
// immediately return false. All callers in a waiting state will awaken and return `false`.
func (p *Pipe[T]) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.done = true

	// Now that the pipe is done, wake up all waiters. Each goroutine
	// will now see that done is `true`, and return immediately.
	p.condEmpty.Broadcast()
	p.condFull.Broadcast()
	return nil
}

// staticRx is a struct that implements the Rx interface. An instance
// begins with a static set of values buffered. Calls to Recv return
// `true` until all items in the buffer have been received. It is not
// possible to add more items to a staticRx after instantiation.
type staticRx[T any] struct {
	mu    sync.Mutex
	items []T
	pos   int
}

// Recv is a function that returns each value from the staticRx's internal
// buffer. Recv will return `true` until each item in the staticRx has been
// received.
func (p *staticRx[T]) Recv(t *T) bool {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.pos == len(p.items) {
		return false
	}

	*t = p.items[p.pos]
	p.pos++
	return true
}

// Close is a function that sets the staticRx's buffer position to the end
// of the buffer. Calling Close will result in subsequent calls to Recv
// returning `false`.
func (p *staticRx[T]) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.pos = len(p.items)
}

// Seq is a function that returns an iter.Seq of the values in the staticRx.
func (p *staticRx[T]) Seq() iter.Seq[T] {
	return func(yield func(T) bool) {
		defer p.Close()

		for {
			var msg T
			ok := p.Recv(&msg)
			if !ok {
				break
			}

			if !yield(msg) {
				break
			}
		}
	}
}

// StaticRx is a function that instantiates a Rx value with the given items.
// Once all of the items have been received from the Rx, subsequent calls to
// Recv on the same Rx will always return `false`.
func StaticRx[T any](items ...T) Rx[T] {
	return &staticRx[T]{
		items: items,
	}
}
