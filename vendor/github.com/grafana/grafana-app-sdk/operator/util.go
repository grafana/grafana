package operator

import (
	"sync"

	"github.com/puzpuzpuz/xsync/v2"
)

// NewListMap returns a pointer to a new properly-initialized ListMap.
// The type parameter is the type of elements in the lists
func NewListMap[T any]() *ListMap[string, T] {
	return &ListMap[string, T]{
		internal: xsync.NewMapOf[[]T](),
		muxes:    xsync.NewMapOf[*sync.RWMutex](),
	}
}

// ListMap is a map of lists which is thread-safe, with read and write distinction.
// The underlying map and slice(s) are not directly accessible, as it would prevent the read/write safety.
type ListMap[K comparable, V any] struct {
	internal *xsync.MapOf[K, []V]
	muxes    *xsync.MapOf[K, *sync.RWMutex]
}

// ItemAt returns the item at index `index` in the list for the map key `key`.
// If the index or key do not exist, it will return an empty value, and a false.
func (l *ListMap[K, V]) ItemAt(key K, index int) (V, bool) {
	list, ok := l.internal.Load(key)
	if ok && len(list) > index {
		return list[index], true
	}
	t := new(V)
	return *t, false
}

// RangeAll ranges through all keys in the map, and all items in each key's list.
// It calls rangeFunc for each item in all lists. `key` is the list's map key,
// `index` is the index within the list, and `value` is the value pointer, as in a normal `range` operation.
func (l *ListMap[K, V]) RangeAll(rangeFunc func(key K, index int, value V)) {
	l.internal.Range(func(key K, _ []V) bool {
		l.Range(key, func(i int, v V) {
			rangeFunc(key, i, v)
		})
		return true
	})
}

// Keys returns a list of all keys in the map at the time of the call.
// It does not lock the map for writing, so new keys may be added during this call which may not be present in the result.
func (l *ListMap[K, V]) Keys() []K {
	keys := make([]K, 0)
	l.internal.Range(func(key K, _ []V) bool {
		keys = append(keys, key)
		return true
	})
	return keys
}

// Size returns the current size of the map.
func (l *ListMap[K, V]) Size() int {
	return l.internal.Size()
}

// KeySize returns the current length of the list for a key.
func (l *ListMap[K, V]) KeySize(key K) int {
	list, ok := l.internal.Load(key)
	if !ok {
		return 0
	}
	return len(list)
}

// Range performs a range operation for a given key's list.
// It consumes a rangeFunc, which takes arguments identical to a traditional go `range` function:
// `index` is the index within the list of the current item, and `value` is the list item at that index.
// `value` is safe to use beyond the list iteration as it is not a re-used pointer like in a typical `range` operation.
func (l *ListMap[K, V]) Range(key K, rangeFunc func(index int, value V)) {
	mux, _ := l.muxes.LoadOrStore(key, &sync.RWMutex{})
	mux.RLock()
	list, ok := l.internal.Load(key)
	mux.RUnlock()
	if !ok {
		return
	}
	for i := 0; i < len(list); i++ {
		rangeFunc(i, list[i])
	}
}

// AddItem adds one or more items to the list for a key. If the key does not exist, it will be added.
// AddItem locks the particular list for writing, so simultaneous AddItem calls for the same key will be sequential,
// and simultaneous AddItem calls for different keys will not impact each other.
func (l *ListMap[K, V]) AddItem(key K, items ...V) {
	mux, _ := l.muxes.LoadOrStore(key, &sync.RWMutex{})
	mux.Lock()
	defer mux.Unlock()
	list, _ := l.internal.LoadOrStore(key, make([]V, 0))
	l.internal.Store(key, append(list, items...))
}

// RemoveKey removes the key from the map. If the key has a list, the list is deleted.
func (l *ListMap[K, V]) RemoveKey(key K) {
	mux, _ := l.muxes.LoadOrStore(key, &sync.RWMutex{})
	mux.Lock()
	defer mux.Unlock()
	l.internal.Delete(key)
}

// RemoveItemAt removes a specific index from the list for a key. If the key or index does not exist, it is a no-op.
// The delete preserves list order after delete, meaning that all items subsequent to the index are left-shifted.
func (l *ListMap[K, V]) RemoveItemAt(key K, index int) {
	mux, _ := l.muxes.LoadOrStore(key, &sync.RWMutex{})
	mux.Lock()
	defer mux.Unlock()
	list, ok := l.internal.Load(key)
	if !ok {
		return
	}
	l.internal.Store(key, l.remove(list, index))
}

// RemoveItem removes the first item in the list for a key which satisfies the `match` function.
// If the key does not exist, or no item in the list satisfies the `match` function, it is a no-op.
// The function returns `true` if an item was deleted, and `false` otherwise.
// The delete preserves list order after delete, meaning that all items subsequent to the index are left-shifted.
func (l *ListMap[K, V]) RemoveItem(key K, match func(V) bool) bool {
	mux, _ := l.muxes.LoadOrStore(key, &sync.RWMutex{})
	mux.Lock()
	defer mux.Unlock()
	list, ok := l.internal.Load(key)
	if !ok {
		return false
	}
	for i := 0; i < len(list); i++ {
		if match(list[i]) {
			l.internal.Store(key, l.remove(list, i))
			return true
		}
	}
	return false
}

// RemoveItems removes the first N (`limit`) items in the list for a key which satisfies the `match` function.
// If `limit` is less than 1, there is no limit to the number of items which can be removed.
// If the key does not exist, or no item in the list satisfies the `match` function, it is a no-op.
// The function returns the number of removed items.
// The delete preserves list order after delete, meaning that all items subsequent to the index are left-shifted.
func (l *ListMap[K, V]) RemoveItems(key K, match func(V) bool, limit int) int {
	mux, _ := l.muxes.LoadOrStore(key, &sync.RWMutex{})
	mux.Lock()
	defer mux.Unlock()
	list, ok := l.internal.Load(key)
	if !ok {
		return 0
	}
	toRemove := make([]int, 0)
	for i := 0; i < len(list); i++ {
		if match(list[i]) {
			toRemove = append(toRemove, i)
			if limit > 0 && len(toRemove) >= limit {
				break
			}
		}
	}
	// Traverse the toRemove list backwards, so we preserve indices as we delete from the list
	for i := len(toRemove) - 1; i >= 0; i-- {
		list = l.remove(list, toRemove[i])
	}
	l.internal.Store(key, list)
	return len(toRemove)
}

func (*ListMap[K, V]) remove(list []V, i int) []V {
	if i > len(list)-1 {
		return list
	}
	switch {
	case i == 0:
		if len(list) > 1 {
			return list[1:]
		}
		return make([]V, 0)
	case i == len(list)-1:
		return list[:i]
	default:
		return append(list[:i], list[i+1:]...)
	}
}
