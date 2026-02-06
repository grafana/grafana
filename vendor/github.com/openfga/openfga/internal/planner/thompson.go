package planner

import (
	"math"
	"math/rand"
	"sync/atomic"
	"time"
	"unsafe"

	"gonum.org/v1/gonum/stat/distuv"
)

// ThompsonStats holds the parameters for the Normal-gamma distribution,
// which models our belief about the performance (execution time) of a strategy.
type ThompsonStats struct {
	params unsafe.Pointer // *samplingParams - atomic access
}

type samplingParams struct {
	mu     float64
	lambda float64
	alpha  float64
	beta   float64
}

// Sample draws a random execution time from the learned distribution.
// This is the core of Thompson Sampling: we sample from our belief and act greedily on that sample.
func (ts *ThompsonStats) Sample(r *rand.Rand) float64 {
	// Load parameters atomically for best performance
	params := (*samplingParams)(atomic.LoadPointer(&ts.params))

	// Fast path gamma sampling using acceptance-rejection
	tau := ts.fastGammaSample(r, params.alpha, params.beta)

	// Fast normal sampling
	variance := 1.0 / (params.lambda * tau)
	if variance <= 0 {
		return params.mu
	}

	// Use standard normal * sqrt(variance) + mean for better performance
	stdNormal := r.NormFloat64()
	mean := params.mu + stdNormal*math.Sqrt(variance)

	return mean
}

// fastGammaSample implements the highly efficient Marsaglia and Tsang acceptance-rejection
// method for generating gamma-distributed random variables for alpha >= 1.
// This avoids the overhead of the more general gonum library for our specific high-performance use case.
// See: G. Marsaglia and W. W. Tsang, "A simple method for generating gamma variables,"
// ACM Trans. Math. Softw. 26, 3 (Sept. 2000), 363-372.
func (ts *ThompsonStats) fastGammaSample(r *rand.Rand, alpha, beta float64) float64 {
	// For alpha >= 1, use acceptance-rejection method (faster than gonum)
	if alpha >= 1.0 {
		d := alpha - 1.0/3.0
		c := 1.0 / math.Sqrt(9.0*d)

		for {
			x := r.NormFloat64()
			v := 1.0 + c*x
			if v <= 0 {
				continue
			}
			v = v * v * v
			u := r.Float64()
			if u < 1.0-0.0331*(x*x)*(x*x) {
				return d * v / beta
			}
			if math.Log(u) < 0.5*x*x+d*(1.0-v+math.Log(v)) {
				return d * v / beta
			}
		}
	}

	// Fallback to gonum for alpha < 1
	return distuv.Gamma{Alpha: alpha, Beta: beta, Src: r}.Rand()
}

// Update performs a Bayesian update on the distribution's parameters
// using the new data point (the observed execution duration). It is the responsibility of the caller
// to enforce synchronization if multiple goroutines may call Update concurrently.
func (ts *ThompsonStats) Update(duration time.Duration) {
	x := float64(duration.Nanoseconds()) / 1e6 // Convert to milliseconds with higher precision

	for {
		// 1. Atomically load the current parameters
		oldPtr := atomic.LoadPointer(&ts.params)
		currentParams := (*samplingParams)(oldPtr)

		// 2. Calculate the new parameters based on the old ones
		newLambda := currentParams.lambda + 1
		newMu := (currentParams.lambda*currentParams.mu + x) / newLambda
		newAlpha := currentParams.alpha + 0.5
		diff := x - currentParams.mu
		newBeta := currentParams.beta + (currentParams.lambda*diff*diff)/(2*newLambda)

		newParams := &samplingParams{
			mu:     newMu,
			lambda: newLambda,
			alpha:  newAlpha,
			beta:   newBeta,
		}

		// 3. Try to atomically swap the old pointer with the new one.
		// If another goroutine changed the pointer in the meantime, this will fail,
		// and we will loop again to retry the whole operation.
		if atomic.CompareAndSwapPointer(&ts.params, oldPtr, unsafe.Pointer(newParams)) {
			return
		}
	}
}

// NewThompsonStats creates a new stats object with a diffuse prior,
// representing our initial uncertainty about a strategy's performance.
func NewThompsonStats(initialGuess time.Duration, lambda, alpha, beta float64) *ThompsonStats {
	initialMs := float64(initialGuess.Nanoseconds()) / 1e6

	ts := &ThompsonStats{}

	// Create the initial immutable parameter snapshot.
	params := &samplingParams{
		mu:     initialMs,
		lambda: lambda,
		alpha:  alpha,
		beta:   beta,
	}
	atomic.StorePointer(&ts.params, unsafe.Pointer(params))

	return ts
}
