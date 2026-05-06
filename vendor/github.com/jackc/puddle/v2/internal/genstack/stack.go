package genstack

// stack is a wrapper around an array implementing a stack.
//
// We cannot use slice to represent the stack because append might change the
// pointer value of the slice. That would be an issue in GenStack
// implementation.
type stack[T any] struct {
	arr []T
}

// push pushes a new element at the top of a stack.
func (s *stack[T]) push(vs ...T) { s.arr = append(s.arr, vs...) }

// pop pops the stack top-most element.
//
// If stack length is zero, this method panics.
func (s *stack[T]) pop() T {
	idx := s.len() - 1
	val := s.arr[idx]

	// Avoid memory leak
	var zero T
	s.arr[idx] = zero

	s.arr = s.arr[:idx]
	return val
}

// takeAll returns all elements in the stack in order as they are stored - i.e.
// the top-most stack element is the last one.
func (s *stack[T]) takeAll() []T {
	arr := s.arr
	s.arr = nil
	return arr
}

// len returns number of elements in the stack.
func (s *stack[T]) len() int { return len(s.arr) }
