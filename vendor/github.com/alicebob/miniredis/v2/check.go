package miniredis

import (
	"reflect"
	"sort"
)

// T is implemented by Testing.T
type T interface {
	Helper()
	Errorf(string, ...interface{})
}

// CheckGet does not call Errorf() iff there is a string key with the
// expected value. Normal use case is `m.CheckGet(t, "username", "theking")`.
func (m *Miniredis) CheckGet(t T, key, expected string) {
	t.Helper()

	found, err := m.Get(key)
	if err != nil {
		t.Errorf("GET error, key %#v: %v", key, err)
		return
	}
	if found != expected {
		t.Errorf("GET error, key %#v: Expected %#v, got %#v", key, expected, found)
		return
	}
}

// CheckList does not call Errorf() iff there is a list key with the
// expected values.
// Normal use case is `m.CheckGet(t, "favorite_colors", "red", "green", "infrared")`.
func (m *Miniredis) CheckList(t T, key string, expected ...string) {
	t.Helper()

	found, err := m.List(key)
	if err != nil {
		t.Errorf("List error, key %#v: %v", key, err)
		return
	}
	if !reflect.DeepEqual(expected, found) {
		t.Errorf("List error, key %#v: Expected %#v, got %#v", key, expected, found)
		return
	}
}

// CheckSet does not call Errorf() iff there is a set key with the
// expected values.
// Normal use case is `m.CheckSet(t, "visited", "Rome", "Stockholm", "Dublin")`.
func (m *Miniredis) CheckSet(t T, key string, expected ...string) {
	t.Helper()

	found, err := m.Members(key)
	if err != nil {
		t.Errorf("Set error, key %#v: %v", key, err)
		return
	}
	sort.Strings(expected)
	if !reflect.DeepEqual(expected, found) {
		t.Errorf("Set error, key %#v: Expected %#v, got %#v", key, expected, found)
		return
	}
}
