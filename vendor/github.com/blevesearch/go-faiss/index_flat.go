package faiss

/*
#include <faiss/c_api/IndexFlat_c.h>
#include <faiss/c_api/Index_c.h>
*/
import "C"
import "unsafe"

// IndexFlat is an index that stores the full vectors and performs exhaustive
// search.
type IndexFlat struct {
	Index
}

// NewIndexFlat creates a new flat index.
func NewIndexFlat(d int, metric int) (*IndexFlat, error) {
	var idx faissIndex
	if c := C.faiss_IndexFlat_new_with(
		&idx.idx,
		C.idx_t(d),
		C.FaissMetricType(metric),
	); c != 0 {
		return nil, getLastError()
	}
	return &IndexFlat{&idx}, nil
}

// NewIndexFlatIP creates a new flat index with the inner product metric type.
func NewIndexFlatIP(d int) (*IndexFlat, error) {
	return NewIndexFlat(d, MetricInnerProduct)
}

// NewIndexFlatL2 creates a new flat index with the L2 metric type.
func NewIndexFlatL2(d int) (*IndexFlat, error) {
	return NewIndexFlat(d, MetricL2)
}

// Xb returns the index's vectors.
// The returned slice becomes invalid after any add or remove operation.
func (idx *IndexFlat) Xb() []float32 {
	var size C.size_t
	var ptr *C.float
	C.faiss_IndexFlat_xb(idx.cPtr(), &ptr, &size)
	return (*[1 << 30]float32)(unsafe.Pointer(ptr))[:size:size]
}

// AsFlat casts idx to a flat index.
// AsFlat panics if idx is not a flat index.
func (idx *IndexImpl) AsFlat() *IndexFlat {
	ptr := C.faiss_IndexFlat_cast(idx.cPtr())
	if ptr == nil {
		panic("index is not a flat index")
	}
	return &IndexFlat{&faissIndex{ptr}}
}
