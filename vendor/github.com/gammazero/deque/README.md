# deque

[![GoDoc](https://pkg.go.dev/badge/github.com/gammazero/deque)](https://pkg.go.dev/github.com/gammazero/deque)
[![Build Status](https://github.com/gammazero/deque/actions/workflows/go.yml/badge.svg)](https://github.com/gammazero/deque/actions/workflows/go.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/gammazero/deque)](https://goreportcard.com/report/github.com/gammazero/deque)
[![codecov](https://codecov.io/gh/gammazero/deque/branch/master/graph/badge.svg)](https://codecov.io/gh/gammazero/deque)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Fast ring-buffer deque ([double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue)) implementation.

For a pictorial description, see the [Deque diagram](https://github.com/gammazero/deque/wiki)

## Installation

```
$ go get github.com/gammazero/deque
```

## Deque data structure

Deque generalizes a queue and a stack, to efficiently add and remove items at either end with O(1) performance. [Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type)) (FIFO) operations are supported using `PushBack` and `PopFront`. [Stack](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) (LIFO) operations are supported using `PushBack` and `PopBack`.

## Ring-buffer Performance

This deque implementation is optimized for CPU and GC performance. The circular buffer automatically re-sizes by powers of two, growing when additional capacity is needed and shrinking when only a quarter of the capacity is used, and uses bitwise arithmetic for all calculations. Since growth is by powers of two, adding elements will only cause O(log n) allocations. A minimum capacity can be set so that there is no resizing at or below that specified amount.

The ring-buffer implementation improves memory and time performance with fewer GC pauses, compared to implementations based on slices and linked lists. By wrapping around the buffer, previously used space is reused, making allocation unnecessary until all buffer capacity is used. If the deque is only filled and then completely emptied before being filled again, then the ring structure offers little benefit for memory reuse over a slice.

For maximum speed, this deque implementation leaves concurrency safety up to the application to provide, however the application chooses, if needed at all.

## Reading Empty Deque

Since it is OK for the deque to contain a `nil` value, it is necessary to either panic or return a second boolean value to indicate the deque is empty, when reading or removing an element. This deque panics when reading from an empty deque. This is a run-time check to help catch programming errors, which may be missed if a second return value is ignored. Simply check `Deque.Len()` before reading from the deque.

## Generics

Deque uses generics to create a Deque that contains items of the type specified. To create a Deque that holds a specific type, provide a type argument to New or with the variable declaration. For example:
```go
    stringDeque := deque.New[string]()
    var intDeque deque.Deque[int]
```

## Example

```go
package main

import (
    "fmt"
    "github.com/gammazero/deque"
)

func main() {
    var q deque.Deque[string]
    q.PushBack("foo")
    q.PushBack("bar")
    q.PushBack("baz")

    fmt.Println(q.Len())   // Prints: 3
    fmt.Println(q.Front()) // Prints: foo
    fmt.Println(q.Back())  // Prints: baz

    q.PopFront() // remove "foo"
    q.PopBack()  // remove "baz"

    q.PushFront("hello")
    q.PushBack("world")

    // Consume deque and print elements.
    for q.Len() != 0 {
        fmt.Println(q.PopFront())
    }
}
```

## Uses

Deque can be used as both a:
- [Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type)) using `PushBack` and `PopFront`
- [Stack](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) using `PushBack` and `PopBack`
