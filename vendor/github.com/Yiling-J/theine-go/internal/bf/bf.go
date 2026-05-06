package bf

import (
	"math"
)

// doorkeeper is a small bloom-filter-based cache admission policy
type Bloomfilter struct {
	Filter            bitvector // our filter bit vector
	M                 uint32    // size of bit vector in bits
	K                 uint32    // distinct hash functions needed
	FalsePositiveRate float64
	Capacity          int
}

func New(falsePositiveRate float64) *Bloomfilter {
	d := &Bloomfilter{FalsePositiveRate: falsePositiveRate}
	d.EnsureCapacity(320)
	return d
}

// create new bloomfilter with given size in bytes
func NewWithSize(size uint32) *Bloomfilter {
	d := &Bloomfilter{}
	bits := size * 8
	m := nextPowerOfTwo(bits)
	d.M = m
	d.Filter = newbv(m)
	return d
}

func (d *Bloomfilter) EnsureCapacity(capacity int) {
	if capacity <= d.Capacity {
		return
	}
	capacity = int(nextPowerOfTwo(uint32(capacity)))
	bits := float64(capacity) * -math.Log(d.FalsePositiveRate) / (math.Log(2.0) * math.Log(2.0)) // in bits
	m := nextPowerOfTwo(uint32(bits))

	if m < 1024 {
		m = 1024
	}

	k := uint32(0.7 * float64(m) / float64(capacity))
	if k < 2 {
		k = 2
	}
	d.Capacity = capacity
	d.M = m
	d.Filter = newbv(m)
	d.K = k
}

func (d *Bloomfilter) Exist(h uint64) bool {
	h1, h2 := uint32(h), uint32(h>>32)
	var o uint = 1
	for i := uint32(0); i < d.K; i++ {
		o &= d.Filter.get((h1 + (i * h2)) & (d.M - 1))
	}
	return o == 1
}

// insert inserts the byte array b into the bloom filter.  Returns true if the value
// was already considered to be in the bloom filter.
func (d *Bloomfilter) Insert(h uint64) bool {
	h1, h2 := uint32(h), uint32(h>>32)
	var o uint = 1
	for i := uint32(0); i < d.K; i++ {
		o &= d.Filter.getset((h1 + (i * h2)) & (d.M - 1))
	}
	return o == 1
}

// Reset clears the bloom filter
func (d *Bloomfilter) Reset() {
	for i := range d.Filter {
		d.Filter[i] = 0
	}
}

// Internal routines for the bit vector
type bitvector []uint64

func newbv(size uint32) bitvector {
	return make([]uint64, uint(size+63)/64)
}

func (b bitvector) get(bit uint32) uint {
	shift := bit % 64
	idx := bit / 64
	bb := b[idx]
	m := uint64(1) << shift
	return uint((bb & m) >> shift)
}

// set bit 'bit' in the bitvector d and return previous value
func (b bitvector) getset(bit uint32) uint {
	shift := bit % 64
	idx := bit / 64
	bb := b[idx]
	m := uint64(1) << shift
	b[idx] |= m
	return uint((bb & m) >> shift)
}

// return the integer >= i which is a power of two
func nextPowerOfTwo(i uint32) uint32 {
	n := i - 1
	n |= n >> 1
	n |= n >> 2
	n |= n >> 4
	n |= n >> 8
	n |= n >> 16
	n++
	return n
}
