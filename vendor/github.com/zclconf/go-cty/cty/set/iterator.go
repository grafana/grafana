package set

type Iterator[T any] struct {
	vals []T
	idx  int
}

func (it *Iterator[T]) Value() T {
	return it.vals[it.idx]
}

func (it *Iterator[T]) Next() bool {
	it.idx++
	return it.idx < len(it.vals)
}
