package s3fifo

import "github.com/maypok86/otter/internal/generated/node"

type queue[K comparable, V any] struct {
	head node.Node[K, V]
	tail node.Node[K, V]
	len  int
}

func newQueue[K comparable, V any]() *queue[K, V] {
	return &queue[K, V]{}
}

func (q *queue[K, V]) length() int {
	return q.len
}

func (q *queue[K, V]) isEmpty() bool {
	return q.length() == 0
}

func (q *queue[K, V]) push(n node.Node[K, V]) {
	if q.isEmpty() {
		q.head = n
		q.tail = n
	} else {
		n.SetPrev(q.tail)
		q.tail.SetNext(n)
		q.tail = n
	}

	q.len++
}

func (q *queue[K, V]) pop() node.Node[K, V] {
	if q.isEmpty() {
		return nil
	}

	result := q.head
	q.delete(result)
	return result
}

func (q *queue[K, V]) delete(n node.Node[K, V]) {
	next := n.Next()
	prev := n.Prev()

	if node.Equals(prev, nil) {
		if node.Equals(next, nil) && !node.Equals(q.head, n) {
			return
		}

		q.head = next
	} else {
		prev.SetNext(next)
		n.SetPrev(nil)
	}

	if node.Equals(next, nil) {
		q.tail = prev
	} else {
		next.SetPrev(prev)
		n.SetNext(nil)
	}

	q.len--
}

func (q *queue[K, V]) clear() {
	for !q.isEmpty() {
		q.pop()
	}
}
