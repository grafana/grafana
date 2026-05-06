// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package distuv

import (
	"math"
	"math/rand/v2"
)

// Categorical is an extension of the Bernoulli distribution where x takes
// values {0, 1, ..., len(w)-1} where w is the weight vector. Categorical must
// be initialized with NewCategorical.
type Categorical struct {
	weights []float64

	// heap is a weight heap.
	//
	// It keeps a heap-organised sum of remaining
	// index weights that are available to be taken
	// from.
	//
	// Each element holds the sum of weights for
	// the corresponding index, plus the sum of
	// its children's weights; the children of
	// an element i can be found at positions
	// 2*(i+1)-1 and 2*(i+1). The root of the
	// weight heap is at element 0.
	//
	// See comments in container/heap for an
	// explanation of the layout of a heap.
	heap []float64

	src rand.Source
}

// NewCategorical constructs a new categorical distribution where the probability
// that x equals i is proportional to w[i]. All of the weights must be
// nonnegative, and at least one of the weights must be positive.
func NewCategorical(w []float64, src rand.Source) Categorical {
	c := Categorical{
		weights: make([]float64, len(w)),
		heap:    make([]float64, len(w)),
		src:     src,
	}
	c.ReweightAll(w)
	return c
}

// CDF computes the value of the cumulative density function at x.
func (c Categorical) CDF(x float64) float64 {
	var cdf float64
	for i, w := range c.weights {
		if x < float64(i) {
			break
		}
		cdf += w
	}
	return cdf / c.heap[0]
}

// Entropy returns the entropy of the distribution.
func (c Categorical) Entropy() float64 {
	var ent float64
	for _, w := range c.weights {
		if w == 0 {
			continue
		}
		p := w / c.heap[0]
		ent += p * math.Log(p)
	}
	return -ent
}

// Len returns the number of values x could possibly take (the length of the
// initial supplied weight vector).
func (c Categorical) Len() int {
	return len(c.weights)
}

// Mean returns the mean of the probability distribution.
func (c Categorical) Mean() float64 {
	var mean float64
	for i, v := range c.weights {
		mean += float64(i) * v
	}
	return mean / c.heap[0]
}

// Prob computes the value of the probability density function at x.
func (c Categorical) Prob(x float64) float64 {
	xi := int(x)
	if float64(xi) != x {
		return 0
	}
	if xi < 0 || xi > len(c.weights)-1 {
		return 0
	}
	return c.weights[xi] / c.heap[0]
}

// LogProb computes the natural logarithm of the value of the probability density function at x.
func (c Categorical) LogProb(x float64) float64 {
	return math.Log(c.Prob(x))
}

// Rand returns a random draw from the categorical distribution.
func (c Categorical) Rand() float64 {
	var r float64
	if c.src == nil {
		r = c.heap[0] * rand.Float64()
	} else {
		r = c.heap[0] * rand.New(c.src).Float64()
	}
	i := 1
	last := -1
	left := len(c.weights)
	for {
		if r -= c.weights[i-1]; r <= 0 {
			break // Fall within item i-1.
		}
		i <<= 1 // Move to left child.
		if d := c.heap[i-1]; r > d {
			r -= d
			// If enough r to pass left child,
			// move to right child state will
			// be caught at break above.
			i++
		}
		if i == last || left < 0 {
			panic("categorical: bad sample")
		}
		last = i
		left--
	}
	return float64(i - 1)
}

// Reweight sets the weight of item idx to w. The input weight must be
// non-negative, and after reweighting at least one of the weights must be
// positive.
func (c Categorical) Reweight(idx int, w float64) {
	if w < 0 {
		panic("categorical: negative weight")
	}
	w, c.weights[idx] = c.weights[idx]-w, w
	idx++
	for idx > 0 {
		c.heap[idx-1] -= w
		idx >>= 1
	}
	if c.heap[0] <= 0 {
		panic("categorical: sum of the weights non-positive")
	}
}

// ReweightAll resets the weights of the distribution. ReweightAll panics if
// len(w) != c.Len. All of the weights must be nonnegative, and at least one of
// the weights must be positive.
func (c Categorical) ReweightAll(w []float64) {
	if len(w) != c.Len() {
		panic("categorical: length of the slices do not match")
	}
	for _, v := range w {
		if v < 0 {
			panic("categorical: negative weight")
		}
	}
	copy(c.weights, w)
	c.reset()
}

func (c Categorical) reset() {
	copy(c.heap, c.weights)
	for i := len(c.heap) - 1; i > 0; i-- {
		// Sometimes 1-based counting makes sense.
		c.heap[((i+1)>>1)-1] += c.heap[i]
	}
	// TODO(btracey): Renormalization for weird weights?
	if c.heap[0] <= 0 {
		panic("categorical: sum of the weights non-positive")
	}
}
