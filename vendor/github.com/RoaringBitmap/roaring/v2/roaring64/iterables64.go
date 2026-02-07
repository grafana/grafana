package roaring64

import (
	"github.com/RoaringBitmap/roaring/v2"
)

// IntIterable64 allows you to iterate over the values in a Bitmap
type IntIterable64 interface {
	HasNext() bool
	Next() uint64
}

// IntPeekable64 allows you to look at the next value without advancing and
// advance as long as the next value is smaller than minval
type IntPeekable64 interface {
	IntIterable64
	// PeekNext peeks the next value without advancing the iterator
	PeekNext() uint64
	// AdvanceIfNeeded advances as long as the next value is smaller than minval
	AdvanceIfNeeded(minval uint64)
}

type intIterator struct {
	pos              int
	hs               uint64
	iter             roaring.IntPeekable
	highlowcontainer *roaringArray64
}

// HasNext returns true if there are more integers to iterate over
func (ii *intIterator) HasNext() bool {
	return ii.pos < ii.highlowcontainer.size()
}

func (ii *intIterator) init() {
	if ii.highlowcontainer.size() > ii.pos {
		ii.iter = ii.highlowcontainer.getContainerAtIndex(ii.pos).Iterator()
		ii.hs = uint64(ii.highlowcontainer.getKeyAtIndex(ii.pos)) << 32
	}
}

// Next returns the next integer
func (ii *intIterator) Next() uint64 {
	lowbits := ii.iter.Next()
	x := uint64(lowbits) | ii.hs
	if !ii.iter.HasNext() {
		ii.pos = ii.pos + 1
		ii.init()
	}
	return x
}

// PeekNext peeks the next value without advancing the iterator
func (ii *intIterator) PeekNext() uint64 {
	return uint64(ii.iter.PeekNext()&maxLowBit) | ii.hs
}

// AdvanceIfNeeded advances as long as the next value is smaller than minval
func (ii *intIterator) AdvanceIfNeeded(minval uint64) {
	to := minval >> 32

	for ii.HasNext() && (ii.hs>>32) < to {
		ii.pos++
		ii.init()
	}

	if ii.HasNext() && (ii.hs>>32) == to {
		ii.iter.AdvanceIfNeeded(lowbits(minval))

		if !ii.iter.HasNext() {
			ii.pos++
			ii.init()
		}
	}
}

func newIntIterator(a *Bitmap) *intIterator {
	p := new(intIterator)
	p.pos = 0
	p.highlowcontainer = &a.highlowcontainer
	p.init()
	return p
}

type intReverseIterator struct {
	pos              int
	hs               uint64
	iter             roaring.IntIterable
	highlowcontainer *roaringArray64
}

// HasNext returns true if there are more integers to iterate over
func (ii *intReverseIterator) HasNext() bool {
	return ii.pos >= 0
}

func (ii *intReverseIterator) init() {
	if ii.pos >= 0 {
		ii.iter = ii.highlowcontainer.getContainerAtIndex(ii.pos).ReverseIterator()
		ii.hs = uint64(ii.highlowcontainer.getKeyAtIndex(ii.pos)) << 32
	} else {
		ii.iter = nil
	}
}

// Next returns the next integer
func (ii *intReverseIterator) Next() uint64 {
	x := uint64(ii.iter.Next()) | ii.hs
	if !ii.iter.HasNext() {
		ii.pos = ii.pos - 1
		ii.init()
	}
	return x
}

func newIntReverseIterator(a *Bitmap) *intReverseIterator {
	p := new(intReverseIterator)
	p.highlowcontainer = &a.highlowcontainer
	p.pos = a.highlowcontainer.size() - 1
	p.init()
	return p
}

// ManyIntIterable64 allows you to iterate over the values in a Bitmap
type ManyIntIterable64 interface {
	// pass in a buffer to fill up with values, returns how many values were returned
	NextMany([]uint64) int
}

type manyIntIterator struct {
	pos              int
	hs               uint64
	iter             roaring.ManyIntIterable
	highlowcontainer *roaringArray64
}

func (ii *manyIntIterator) init() {
	if ii.highlowcontainer.size() > ii.pos {
		ii.iter = ii.highlowcontainer.getContainerAtIndex(ii.pos).ManyIterator()
		ii.hs = uint64(ii.highlowcontainer.getKeyAtIndex(ii.pos)) << 32
	} else {
		ii.iter = nil
	}
}

func (ii *manyIntIterator) NextMany(buf []uint64) int {
	n := 0
	for n < len(buf) {
		if ii.iter == nil {
			break
		}
		moreN := ii.iter.NextMany64(ii.hs, buf[n:])
		n += moreN
		if moreN == 0 {
			ii.pos = ii.pos + 1
			ii.init()
		}
	}

	return n
}

func newManyIntIterator(a *Bitmap) *manyIntIterator {
	p := new(manyIntIterator)
	p.pos = 0
	p.highlowcontainer = &a.highlowcontainer
	p.init()
	return p
}
