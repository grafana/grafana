package miniredis

import (
	"github.com/alicebob/miniredis/v2/hyperloglog"
)

type hll struct {
	inner *hyperloglog.Sketch
}

func newHll() *hll {
	return &hll{
		inner: hyperloglog.New14(),
	}
}

// Add returns true if cardinality has been changed, or false otherwise.
func (h *hll) Add(item []byte) bool {
	return h.inner.Insert(item)
}

// Count returns the estimation of a set cardinality.
func (h *hll) Count() int {
	return int(h.inner.Estimate())
}

// Merge merges the other hll into original one (not making a copy but doing this in place).
func (h *hll) Merge(other *hll) {
	_ = h.inner.Merge(other.inner)
}

// Bytes returns raw-bytes representation of hll data structure.
func (h *hll) Bytes() []byte {
	dataBytes, _ := h.inner.MarshalBinary()
	return dataBytes
}

func (h *hll) copy() *hll {
	return &hll{
		inner: h.inner.Clone(),
	}
}
