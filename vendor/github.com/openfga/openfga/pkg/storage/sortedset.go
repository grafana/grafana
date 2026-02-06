package storage

import "github.com/emirpasic/gods/trees/redblacktree"

// SortedSet stores a set (no duplicates allowed) of string IDs in memory
// in a way that also provides fast sorted access.
type SortedSet interface {
	Size() int

	// Min returns an empty string if the set is empty.
	Min() string

	// Max returns an empty string if the set is empty.
	Max() string
	Add(value string)
	Exists(value string) bool

	// Values returns the elements in the set in sorted order (ascending).
	Values() []string
}

type RedBlackTreeSet struct {
	inner *redblacktree.Tree
}

var _ SortedSet = (*RedBlackTreeSet)(nil)

func NewSortedSet(vals ...string) *RedBlackTreeSet {
	c := &RedBlackTreeSet{
		inner: redblacktree.NewWithStringComparator(),
	}

	for _, val := range vals {
		c.Add(val)
	}
	return c
}

func (r *RedBlackTreeSet) Min() string {
	if r.Size() == 0 {
		return ""
	}
	return r.inner.Left().Key.(string)
}

func (r *RedBlackTreeSet) Max() string {
	if r.Size() == 0 {
		return ""
	}
	return r.inner.Right().Key.(string)
}

func (r *RedBlackTreeSet) Add(value string) {
	r.inner.Put(value, nil)
}

func (r *RedBlackTreeSet) Exists(value string) bool {
	_, ok := r.inner.Get(value)
	return ok
}

func (r *RedBlackTreeSet) Size() int {
	return r.inner.Size()
}

func (r *RedBlackTreeSet) Values() []string {
	values := make([]string, 0, r.inner.Size())
	for _, v := range r.inner.Keys() {
		values = append(values, v.(string))
	}
	return values
}
