package iter

import (
	"sync"

	"github.com/sourcegraph/conc/internal/multierror"
)

// Mapper is an Iterator with a result type R. It can be used to configure
// the behaviour of Map and MapErr. The zero value is safe to use with
// reasonable defaults.
//
// Mapper is also safe for reuse and concurrent use.
type Mapper[T, R any] Iterator[T]

// Map applies f to each element of input, returning the mapped result.
//
// Map always uses at most runtime.GOMAXPROCS goroutines. For a configurable
// goroutine limit, use a custom Mapper.
func Map[T, R any](input []T, f func(*T) R) []R {
	return Mapper[T, R]{}.Map(input, f)
}

// Map applies f to each element of input, returning the mapped result.
//
// Map uses up to the configured Mapper's maximum number of goroutines.
func (m Mapper[T, R]) Map(input []T, f func(*T) R) []R {
	res := make([]R, len(input))
	Iterator[T](m).ForEachIdx(input, func(i int, t *T) {
		res[i] = f(t)
	})
	return res
}

// MapErr applies f to each element of the input, returning the mapped result
// and a combined error of all returned errors.
//
// Map always uses at most runtime.GOMAXPROCS goroutines. For a configurable
// goroutine limit, use a custom Mapper.
func MapErr[T, R any](input []T, f func(*T) (R, error)) ([]R, error) {
	return Mapper[T, R]{}.MapErr(input, f)
}

// MapErr applies f to each element of the input, returning the mapped result
// and a combined error of all returned errors.
//
// Map uses up to the configured Mapper's maximum number of goroutines.
func (m Mapper[T, R]) MapErr(input []T, f func(*T) (R, error)) ([]R, error) {
	var (
		res    = make([]R, len(input))
		errMux sync.Mutex
		errs   error
	)
	Iterator[T](m).ForEachIdx(input, func(i int, t *T) {
		var err error
		res[i], err = f(t)
		if err != nil {
			errMux.Lock()
			// TODO: use stdlib errors once multierrors land in go 1.20
			errs = multierror.Join(errs, err)
			errMux.Unlock()
		}
	})
	return res, errs
}
