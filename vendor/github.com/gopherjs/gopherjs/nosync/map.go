package nosync

// Map is a concurrent map with amortized-constant-time loads, stores, and deletes.
// It is safe for multiple goroutines to call a Map's methods concurrently.
//
// The zero Map is valid and empty.
//
// A Map must not be copied after first use.
type Map struct {
	m map[interface{}]interface{}
}

// Load returns the value stored in the map for a key, or nil if no
// value is present.
// The ok result indicates whether value was found in the map.
func (m *Map) Load(key interface{}) (value interface{}, ok bool) {
	value, ok = m.m[key]
	return value, ok
}

// Store sets the value for a key.
func (m *Map) Store(key, value interface{}) {
	if m.m == nil {
		m.m = make(map[interface{}]interface{})
	}
	m.m[key] = value
}

// LoadOrStore returns the existing value for the key if present.
// Otherwise, it stores and returns the given value.
// The loaded result is true if the value was loaded, false if stored.
func (m *Map) LoadOrStore(key, value interface{}) (actual interface{}, loaded bool) {
	if value, ok := m.m[key]; ok {
		return value, true
	}
	if m.m == nil {
		m.m = make(map[interface{}]interface{})
	}
	m.m[key] = value
	return value, false
}

// Delete deletes the value for a key.
func (m *Map) Delete(key interface{}) {
	if m.m == nil {
		return
	}
	delete(m.m, key)
}

// Range calls f sequentially for each key and value present in the map.
// If f returns false, range stops the iteration.
//
// Range does not necessarily correspond to any consistent snapshot of the Map's
// contents: no key will be visited more than once, but if the value for any key
// is stored or deleted concurrently, Range may reflect any mapping for that key
// from any point during the Range call.
//
// Range may be O(N) with the number of elements in the map even if f returns
// false after a constant number of calls.
func (m *Map) Range(f func(key, value interface{}) bool) {
	for k, v := range m.m {
		if !f(k, v) {
			break
		}
	}
}
