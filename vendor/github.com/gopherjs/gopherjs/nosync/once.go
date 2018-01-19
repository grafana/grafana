package nosync

// Once is an object that will perform exactly one action.
type Once struct {
	doing bool
	done  bool
}

// Do calls the function f if and only if Do is being called for the
// first time for this instance of Once. In other words, given
// 	var once Once
// if once.Do(f) is called multiple times, only the first call will invoke f,
// even if f has a different value in each invocation.  A new instance of
// Once is required for each function to execute.
//
// Do is intended for initialization that must be run exactly once.  Since f
// is niladic, it may be necessary to use a function literal to capture the
// arguments to a function to be invoked by Do:
// 	config.once.Do(func() { config.init(filename) })
//
// If f causes Do to be called, it will panic.
//
// If f panics, Do considers it to have returned; future calls of Do return
// without calling f.
//
func (o *Once) Do(f func()) {
	if o.done {
		return
	}
	if o.doing {
		panic("nosync: Do called within f")
	}
	o.doing = true
	defer func() {
		o.doing = false
		o.done = true
	}()
	f()
}
