package hyperloglog

import (
	"math"
)

type reg uint8
type tailcuts []reg

type registers struct {
	tailcuts
	nz uint32
}

func (r *reg) set(offset, val uint8) bool {
	var isZero bool
	if offset == 0 {
		isZero = *r < 16
		tmpVal := uint8((*r) << 4 >> 4)
		*r = reg(tmpVal | (val << 4))
	} else {
		isZero = *r&0x0f == 0
		tmpVal := uint8((*r) >> 4 << 4)
		*r = reg(tmpVal | val)
	}
	return isZero
}

func (r *reg) get(offset uint8) uint8 {
	if offset == 0 {
		return uint8((*r) >> 4)
	}
	return uint8((*r) << 4 >> 4)
}

func newRegisters(size uint32) *registers {
	return &registers{
		tailcuts: make(tailcuts, size/2),
		nz:       size,
	}
}

func (rs *registers) clone() *registers {
	if rs == nil {
		return nil
	}
	tc := make([]reg, len(rs.tailcuts))
	copy(tc, rs.tailcuts)
	return &registers{
		tailcuts: tc,
		nz:       rs.nz,
	}
}

func (rs *registers) rebase(delta uint8) {
	nz := uint32(len(rs.tailcuts)) * 2
	for i := range rs.tailcuts {
		for j := uint8(0); j < 2; j++ {
			val := rs.tailcuts[i].get(j)
			if val >= delta {
				rs.tailcuts[i].set(j, val-delta)
				if val-delta > 0 {
					nz--
				}
			}
		}
	}
	rs.nz = nz
}

func (rs *registers) set(i uint32, val uint8) {
	offset, index := uint8(i)&1, i/2
	if rs.tailcuts[index].set(offset, val) {
		rs.nz--
	}
}

func (rs *registers) get(i uint32) uint8 {
	offset, index := uint8(i)&1, i/2
	return rs.tailcuts[index].get(offset)
}

func (rs *registers) sumAndZeros(base uint8) (res, ez float64) {
	for _, r := range rs.tailcuts {
		for j := uint8(0); j < 2; j++ {
			v := float64(base + r.get(j))
			if v == 0 {
				ez++
			}
			res += 1.0 / math.Pow(2.0, v)
		}
	}
	rs.nz = uint32(ez)
	return res, ez
}

func (rs *registers) min() uint8 {
	if rs.nz > 0 {
		return 0
	}
	min := uint8(math.MaxUint8)
	for _, r := range rs.tailcuts {
		if r == 0 || min == 0 {
			return 0
		}
		if val := uint8(r << 4 >> 4); val < min {
			min = val
		}
		if val := uint8(r >> 4); val < min {
			min = val
		}
	}
	return min
}
