package query

import (
	"sort"
	"sync"
)

type SyncMap struct {
	m   *sync.Map
	mtx *sync.Mutex
}

func NewSyncMap() *SyncMap {
	return &SyncMap{
		m:   &sync.Map{},
		mtx: &sync.Mutex{},
	}
}

func (m SyncMap) store(key string, value interface{}) {
	m.m.Store(key, value)
}

func (m SyncMap) load(key string) (interface{}, bool) {
	return m.m.Load(key)
}

func (m SyncMap) delete(key string) {
	m.m.Delete(key)
}

func (m SyncMap) exists(name string) bool {
	_, ok := m.m.Load(name)
	return ok
}

func (m SyncMap) lock() {
	m.mtx.Lock()
}

func (m SyncMap) unlock() {
	m.mtx.Unlock()
}

func (m SyncMap) Clear() {
	m.lock()
	m.Range(func(key, value interface{}) bool {
		m.m.Delete(key)
		return true
	})
	m.unlock()
}

func (m SyncMap) Range(fn func(key, value interface{}) bool) {
	m.m.Range(fn)
}

func (m SyncMap) Keys() []string {
	keys := make([]string, 0, 10)
	m.m.Range(func(key, value interface{}) bool {
		keys = append(keys, key.(string))
		return true
	})
	return keys
}

func (m SyncMap) Len() int {
	cnt := 0
	m.m.Range(func(key, value interface{}) bool {
		cnt++
		return true
	})
	return cnt
}

func (m SyncMap) SortedKeys() []string {
	keys := m.Keys()
	sort.Strings(keys)
	return keys
}
