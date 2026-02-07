/*
Package deque provides a fast ring-buffer deque (double-ended queue)
implementation.

Deque generalizes a queue and a stack, to efficiently add and remove items at
either end with O(1) performance. Queue (FIFO) operations are supported using
PushBack and PopFront. Stack (LIFO) operations are supported using PushBack and
PopBack.

# Ring-buffer Performance

The ring-buffer automatically resizes by powers of two, growing when additional
capacity is needed and shrinking when only a quarter of the capacity is used,
and uses bitwise arithmetic for all calculations.

The ring-buffer implementation significantly improves memory and time
performance with fewer GC pauses, compared to implementations based on slices
and linked lists.

For maximum speed, this deque implementation leaves concurrency safety up to
the application to provide, however the application chooses, if needed at all.

# Reading Empty Deque

Since it is OK for the deque to contain the zero-value of an item, it is
necessary to either panic or return a second boolean value to indicate the
deque is empty, when reading or removing an element. This deque panics when
reading from an empty deque. This is a run-time check to help catch programming
errors, which may be missed if a second return value is ignored. Simply check
Deque.Len() before reading from the deque.

# Generics

Deque uses generics to create a Deque that contains items of the type
specified. To create a Deque that holds a specific type, provide a type
argument to New or with the variable declaration.
*/
package deque
