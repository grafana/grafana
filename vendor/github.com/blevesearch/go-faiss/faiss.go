// Package faiss provides bindings to Faiss, a library for vector similarity
// search.
// More detailed documentation can be found at the Faiss wiki:
// https://github.com/facebookresearch/faiss/wiki.
package faiss

/*
#cgo LDFLAGS: -lfaiss_c

#include <faiss/c_api/Index_c.h>
#include <faiss/c_api/error_c.h>
#include <faiss/c_api/utils/distances_c.h>
*/
import "C"
import "errors"

func getLastError() error {
	return errors.New(C.GoString(C.faiss_get_last_error()))
}

// Metric type
const (
	MetricInnerProduct  = C.METRIC_INNER_PRODUCT
	MetricL2            = C.METRIC_L2
	MetricL1            = C.METRIC_L1
	MetricLinf          = C.METRIC_Linf
	MetricLp            = C.METRIC_Lp
	MetricCanberra      = C.METRIC_Canberra
	MetricBrayCurtis    = C.METRIC_BrayCurtis
	MetricJensenShannon = C.METRIC_JensenShannon
)

// In-place normalization of provided vector (single)
func NormalizeVector(vector []float32) []float32 {
	C.faiss_fvec_renorm_L2(
		C.size_t(len(vector)),
		1, // number of vectors
		(*C.float)(&vector[0]))

	return vector
}
