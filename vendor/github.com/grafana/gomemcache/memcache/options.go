package memcache

var nopAllocator = &defaultAllocator{}

func newOptions(opts ...Option) *Options {
	o := &Options{
		Alloc: nopAllocator,
	}

	for _, opt := range opts {
		opt(o)
	}

	return o
}

// Options are used to modify the behavior of an individual Get or GetMulti
// call made by the Client. They are constructed by applying Option callbacks
// passed to a Client method to a default Options instance.
type Options struct {
	Alloc Allocator
}

// Option is a callback used to modify the Options that a particular Client
// method uses.
type Option func(opts *Options)

// WithAllocator creates a new Option that makes use of a specific memory Allocator
// for result values (Item.Value) loaded from memcached.
func WithAllocator(alloc Allocator) Option {
	return func(opts *Options) {
		opts.Alloc = alloc
	}
}

// Allocator allows memory for memcached result values (Item.Value) to be managed by
// callers of the Client instead of by the Client itself. For example, this can be
// used by callers to implement arena-style memory management. The default implementation
// used, when not otherwise overridden, uses `make` and relies on GC for cleanup.
type Allocator interface {
	// Get returns a byte slice with at least sz capacity. Length of the slice is
	// not guaranteed and so must be asserted by callers (the Client).
	Get(sz int) *[]byte
	// Put returns the byte slice to the underlying allocator. The Client will
	// only call this method during error handling when allocated values are not
	// returned to the caller as cache results.
	Put(b *[]byte)
}

type defaultAllocator struct{}

func (d defaultAllocator) Get(sz int) *[]byte {
	b := make([]byte, sz)
	return &b
}

func (d defaultAllocator) Put(_ *[]byte) {
	// no-op
}
