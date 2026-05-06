package faiss

/*
#include <faiss/c_api/impl/AuxIndexStructures_c.h>
*/
import "C"

type Selector interface {
	Get() *C.FaissIDSelector
	Delete()
}

// IDSelector represents a set of IDs to remove.
type IDSelector struct {
	sel *C.FaissIDSelector
}

// Delete frees the memory associated with s.
func (s *IDSelector) Delete() {
	if s == nil || s.sel == nil {
		return
	}

	C.faiss_IDSelector_free(s.sel)
}

func (s *IDSelector) Get() *C.FaissIDSelector {
	return s.sel
}

type IDSelectorNot struct {
	sel      *C.FaissIDSelector
	batchSel *C.FaissIDSelector
}

// Delete frees the memory associated with s.
func (s *IDSelectorNot) Delete() {
	if s == nil {
		return
	}

	if s.sel != nil {
		C.faiss_IDSelector_free(s.sel)
	}
	if s.batchSel != nil {
		C.faiss_IDSelector_free(s.batchSel)
	}
}

func (s *IDSelectorNot) Get() *C.FaissIDSelector {
	return s.sel
}

// NewIDSelectorRange creates a selector that removes IDs on [imin, imax).
func NewIDSelectorRange(imin, imax int64) (Selector, error) {
	var sel *C.FaissIDSelectorRange
	c := C.faiss_IDSelectorRange_new(&sel, C.idx_t(imin), C.idx_t(imax))
	if c != 0 {
		return nil, getLastError()
	}
	return &IDSelector{(*C.FaissIDSelector)(sel)}, nil
}

// NewIDSelectorBatch creates a new batch selector.
func NewIDSelectorBatch(indices []int64) (Selector, error) {
	var sel *C.FaissIDSelectorBatch
	if c := C.faiss_IDSelectorBatch_new(
		&sel,
		C.size_t(len(indices)),
		(*C.idx_t)(&indices[0]),
	); c != 0 {
		return nil, getLastError()
	}
	return &IDSelector{(*C.FaissIDSelector)(sel)}, nil
}

// NewIDSelectorNot creates a new Not selector, wrapped around a
// batch selector, with the IDs in 'exclude'.
func NewIDSelectorNot(exclude []int64) (Selector, error) {
	batchSelector, err := NewIDSelectorBatch(exclude)
	if err != nil {
		return nil, err
	}

	var sel *C.FaissIDSelectorNot
	if c := C.faiss_IDSelectorNot_new(
		&sel,
		batchSelector.Get(),
	); c != 0 {
		batchSelector.Delete()
		return nil, getLastError()
	}
	return &IDSelectorNot{sel: (*C.FaissIDSelector)(sel),
		batchSel: batchSelector.Get()}, nil
}
