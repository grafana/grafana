package gls

var (
	stackTagPool = &idPool{}
)

// Will return this goroutine's identifier if set. If you always need a
// goroutine identifier, you should use EnsureGoroutineId which will make one
// if there isn't one already.
func GetGoroutineId() (gid uint, ok bool) {
	return readStackTag()
}

// Will call cb with the current goroutine identifier. If one hasn't already
// been generated, one will be created and set first. The goroutine identifier
// might be invalid after cb returns.
func EnsureGoroutineId(cb func(gid uint)) {
	if gid, ok := readStackTag(); ok {
		cb(gid)
		return
	}
	gid := stackTagPool.Acquire()
	defer stackTagPool.Release(gid)
	addStackTag(gid, func() { cb(gid) })
}
