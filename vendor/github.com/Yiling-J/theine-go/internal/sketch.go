package internal

import (
	"math/bits"
)

const (
	resetMask = 0x7777777777777777
	oneMask   = 0x1111111111111111
)

type CountMinSketch struct {
	Table      []uint64
	Additions  uint
	SampleSize uint
	BlockMask  uint
}

func NewCountMinSketch() *CountMinSketch {
	new := &CountMinSketch{}
	new.EnsureCapacity(64)
	return new
}

// indexOf return table index and counter index together
func (s *CountMinSketch) indexOf(counterHash uint64, block uint64, offset uint8) (uint, uint) {
	h := counterHash >> (offset << 3)
	// max block + 7(8 * 8 bytes), fit 64 bytes cache line
	index := block + h&1 + uint64(offset<<1)
	return uint(index), uint((h >> 1) & 0xf)
}

func (s *CountMinSketch) inc(index uint, offset uint) bool {
	offset = offset << 2
	mask := uint64(0xF << offset)
	v := s.Table[index]
	if v&mask != mask {
		s.Table[index] = v + 1<<offset
		return true
	}
	return false
}

func (s *CountMinSketch) Add(h uint64) bool {
	blockHash := h
	block := (blockHash & uint64(s.BlockMask)) << 3
	counterHash := rehash(h)
	index0, offset0 := s.indexOf(counterHash, block, 0)
	index1, offset1 := s.indexOf(counterHash, block, 1)
	index2, offset2 := s.indexOf(counterHash, block, 2)
	index3, offset3 := s.indexOf(counterHash, block, 3)

	added := s.inc(index0, offset0)
	added = s.inc(index1, offset1) || added
	added = s.inc(index2, offset2) || added
	added = s.inc(index3, offset3) || added

	if added {
		s.Additions += 1
		if s.Additions == s.SampleSize {
			s.reset()
			return true
		}
	}
	return false
}

// used in test and persistence restore
func (s *CountMinSketch) Addn(h uint64, n int) {
	hn := h
	block := (hn & uint64(s.BlockMask)) << 3
	hc := rehash(h)
	index0, offset0 := s.indexOf(hc, block, 0)
	index1, offset1 := s.indexOf(hc, block, 1)
	index2, offset2 := s.indexOf(hc, block, 2)
	index3, offset3 := s.indexOf(hc, block, 3)

	for i := 0; i < n; i++ {
		s.inc(index0, offset0)
		s.inc(index1, offset1)
		s.inc(index2, offset2)
		s.inc(index3, offset3)
	}
}

func (s *CountMinSketch) reset() {
	count := 0
	for i := range s.Table {
		v := s.Table[i]
		count += bits.OnesCount64(v & oneMask)

		s.Table[i] = (v >> 1) & resetMask
	}
	s.Additions = (s.Additions - uint(count>>2)) >> 1
}

func (s *CountMinSketch) count(h uint64, block uint64, offset uint8) uint {
	index, off := s.indexOf(h, block, offset)
	off = off << 2
	count := (s.Table[index] >> off) & 0xF
	return uint(count)
}

// used in test
func uint64ToBase10Slice(n uint64) []int {
	result := make([]int, 16)
	for i := 0; i < 16; i++ {
		result[15-i] = int((n >> (i * 4)) & 0xF)
	}
	return result
}

// used in test
func (s *CountMinSketch) counters() [][]int {
	all := [][]int{}
	for i := 0; i < len(s.Table); i++ {
		all = append(all, uint64ToBase10Slice(s.Table[i]))
	}
	return all
}

func min(a, b uint) uint {
	if a < b {
		return a
	}
	return b
}

func (s *CountMinSketch) Estimate(h uint64) uint {
	block := (h & uint64(s.BlockMask)) << 3
	hc := rehash(h)
	m := min(s.count(hc, block, 0), 100)
	m = min(s.count(hc, block, 1), m)
	m = min(s.count(hc, block, 2), m)
	m = min(s.count(hc, block, 3), m)
	return m
}

func (s *CountMinSketch) EnsureCapacity(size uint) {
	if len(s.Table) >= int(size) {
		return
	}
	if size < 16 {
		size = 16
	}
	newSize := next2Power(size)
	s.Table = make([]uint64, newSize)
	s.SampleSize = 10 * newSize
	s.BlockMask = uint((len(s.Table) >> 3) - 1)
	s.Additions = 0
}

func rehash(h uint64) uint64 {
	h *= 0x94d049bb133111eb
	h ^= h >> 31
	return h
}
