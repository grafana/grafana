package gls

var (
	symPool = &idPool{}
)

// ContextKey is a throwaway value you can use as a key to a ContextManager
type ContextKey struct{ id uint }

// GenSym will return a brand new, never-before-used ContextKey
func GenSym() ContextKey {
	return ContextKey{id: symPool.Acquire()}
}
