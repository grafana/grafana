package puddle

type resList[T any] []*Resource[T]

func (l *resList[T]) append(val *Resource[T]) { *l = append(*l, val) }

func (l *resList[T]) popBack() *Resource[T] {
	idx := len(*l) - 1
	val := (*l)[idx]
	(*l)[idx] = nil // Avoid memory leak
	*l = (*l)[:idx]

	return val
}

func (l *resList[T]) remove(val *Resource[T]) {
	for i, elem := range *l {
		if elem == val {
			lastIdx := len(*l) - 1
			(*l)[i] = (*l)[lastIdx]
			(*l)[lastIdx] = nil // Avoid memory leak
			(*l) = (*l)[:lastIdx]
			return
		}
	}

	panic("BUG: removeResource could not find res in slice")
}
