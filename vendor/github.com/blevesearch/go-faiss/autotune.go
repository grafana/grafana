package faiss

/*
#include <stdlib.h>
#include <faiss/c_api/AutoTune_c.h>
*/
import "C"
import (
	"unsafe"
)

type ParameterSpace struct {
	ps *C.FaissParameterSpace
}

// NewParameterSpace creates a new ParameterSpace.
func NewParameterSpace() (*ParameterSpace, error) {
	var ps *C.FaissParameterSpace
	if c := C.faiss_ParameterSpace_new(&ps); c != 0 {
		return nil, getLastError()
	}
	return &ParameterSpace{ps}, nil
}

// SetIndexParameter sets one of the parameters.
func (p *ParameterSpace) SetIndexParameter(idx Index, name string, val float64) error {
	cname := C.CString(name)

	defer func() {
		C.free(unsafe.Pointer(cname))
	}()

	c := C.faiss_ParameterSpace_set_index_parameter(
		p.ps, idx.cPtr(), cname, C.double(val))
	if c != 0 {
		return getLastError()
	}
	return nil
}

// Delete frees the memory associated with p.
func (p *ParameterSpace) Delete() {
	C.faiss_ParameterSpace_free(p.ps)
}
