package gls

import (
	"sync"
)

var (
	keyMtx     sync.Mutex
	keyCounter uint64
)

// ContextKey is a throwaway value you can use as a key to a ContextManager
type ContextKey struct{ id uint64 }

// GenSym will return a brand new, never-before-used ContextKey
func GenSym() ContextKey {
	keyMtx.Lock()
	defer keyMtx.Unlock()
	keyCounter += 1
	return ContextKey{id: keyCounter}
}
