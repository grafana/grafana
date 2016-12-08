package amqp

import (
	"math/rand"
	"testing"
)

func TestAllocatorFirstShouldBeTheLow(t *testing.T) {
	n, ok := newAllocator(1, 2).next()
	if !ok {
		t.Fatalf("expected to allocate between 1 and 2")
	}

	if want, got := 1, n; want != got {
		t.Fatalf("expected to first allocation to be 1")
	}
}

func TestAllocatorShouldBeBoundByHigh(t *testing.T) {
	a := newAllocator(1, 2)

	if n, ok := a.next(); n != 1 || !ok {
		t.Fatalf("expected to allocate between 1 and 2, got %d, %v", n, ok)
	}
	if n, ok := a.next(); n != 2 || !ok {
		t.Fatalf("expected to allocate between 1 and 2, got %d, %v", n, ok)
	}
	if _, ok := a.next(); ok {
		t.Fatalf("expected not to allocate outside of 1 and 2")
	}
}

func TestAllocatorStringShouldIncludeAllocatedRanges(t *testing.T) {
	a := newAllocator(1, 10)
	a.reserve(1)
	a.reserve(2)
	a.reserve(3)
	a.reserve(5)
	a.reserve(6)
	a.reserve(8)
	a.reserve(10)

	if want, got := "allocator[1..10] 1..3 5..6 8 10", a.String(); want != got {
		t.Fatalf("expected String of %q, got %q", want, got)
	}
}

func TestAllocatorShouldReuseReleased(t *testing.T) {
	a := newAllocator(1, 2)

	first, _ := a.next()
	if want, got := 1, first; want != got {
		t.Fatalf("expected allocation to be %d, got: %d", want, got)
	}

	second, _ := a.next()
	if want, got := 2, second; want != got {
		t.Fatalf("expected allocation to be %d, got: %d", want, got)
	}

	a.release(first)

	third, _ := a.next()
	if want, got := first, third; want != got {
		t.Fatalf("expected third allocation to be %d, got: %d", want, got)
	}

	_, ok := a.next()
	if want, got := false, ok; want != got {
		t.Fatalf("expected fourth allocation to saturate the pool")
	}
}

func TestAllocatorReleasesKeepUpWithAllocationsForAllSizes(t *testing.T) {
	const runs = 5
	const max = 13

	for lim := 1; lim < 2<<max; lim <<= 1 {
		a := newAllocator(0, lim)

		for i := 0; i < runs*lim; i++ {
			if i >= lim { // fills the allocator
				a.release(int(rand.Int63n(int64(lim))))
			}
			if _, ok := a.next(); !ok {
				t.Fatalf("expected %d runs of random release of size %d not to fail on allocation %d", runs, lim, i)
			}
		}
	}
}
