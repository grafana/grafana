package genstack

// GenStack implements a generational stack.
//
// GenStack works as common stack except for the fact that all elements in the
// older generation are guaranteed to be popped before any element in the newer
// generation. New elements are always pushed to the current (newest)
// generation.
//
// We could also say that GenStack behaves as a stack in case of a single
// generation, but it behaves as a queue of individual generation stacks.
type GenStack[T any] struct {
	// We can represent arbitrary number of generations using 2 stacks. The
	// new stack stores all new pushes and the old stack serves all reads.
	// Old stack can represent multiple generations. If old == new, then all
	// elements pushed in previous (not current) generations have already
	// been popped.

	old *stack[T]
	new *stack[T]
}

// NewGenStack creates a new empty GenStack.
func NewGenStack[T any]() *GenStack[T] {
	s := &stack[T]{}
	return &GenStack[T]{
		old: s,
		new: s,
	}
}

func (s *GenStack[T]) Pop() (T, bool) {
	// Pushes always append to the new stack, so if the old once becomes
	// empty, it will remail empty forever.
	if s.old.len() == 0 && s.old != s.new {
		s.old = s.new
	}

	if s.old.len() == 0 {
		var zero T
		return zero, false
	}

	return s.old.pop(), true
}

// Push pushes a new element at the top of the stack.
func (s *GenStack[T]) Push(v T) { s.new.push(v) }

// NextGen starts a new stack generation.
func (s *GenStack[T]) NextGen() {
	if s.old == s.new {
		s.new = &stack[T]{}
		return
	}

	// We need to pop from the old stack to the top of the new stack. Let's
	// have an example:
	//
	//   Old: <bottom> 4 3 2 1
	//   New: <bottom> 8 7 6 5
	//   PopOrder: 1 2 3 4 5 6 7 8
	//
	//
	// To preserve pop order, we have to take all elements from the old
	// stack and push them to the top of new stack:
	//
	//   New: 8 7 6 5 4 3 2 1
	//
	s.new.push(s.old.takeAll()...)

	// We have the old stack allocated and empty, so why not to reuse it as
	// new new stack.
	s.old, s.new = s.new, s.old
}

// Len returns number of elements in the stack.
func (s *GenStack[T]) Len() int {
	l := s.old.len()
	if s.old != s.new {
		l += s.new.len()
	}

	return l
}
