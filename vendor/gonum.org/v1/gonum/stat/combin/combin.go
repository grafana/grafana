// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package combin

import (
	"math"
	"sort"
)

const (
	errNegInput             = "combin: negative input"
	badSetSize              = "combin: n < k"
	badInput                = "combin: wrong input slice length"
	errNonpositiveDimension = "combin: non-positive dimension"
)

// Binomial returns the binomial coefficient of (n,k), also commonly referred to
// as "n choose k".
//
// The binomial coefficient, C(n,k), is the number of unordered combinations of
// k elements in a set that is n elements big, and is defined as
//
//	C(n,k) = n!/((n-k)!k!)
//
// n and k must be non-negative with n >= k, otherwise Binomial will panic.
// No check is made for overflow.
func Binomial(n, k int) int {
	if n < 0 || k < 0 {
		panic(errNegInput)
	}
	if n < k {
		panic(badSetSize)
	}
	// (n,k) = (n, n-k)
	if k > n/2 {
		k = n - k
	}
	b := 1
	for i := 1; i <= k; i++ {
		b = (n - k + i) * b / i
	}
	return b
}

// GeneralizedBinomial returns the generalized binomial coefficient of (n, k),
// defined as
//
//	Γ(n+1) / (Γ(k+1) Γ(n-k+1))
//
// where Γ is the Gamma function. GeneralizedBinomial is useful for continuous
// relaxations of the binomial coefficient, or when the binomial coefficient value
// may overflow int. In the latter case, one may use math/big for an exact
// computation.
//
// n and k must be non-negative with n >= k, otherwise GeneralizedBinomial will panic.
func GeneralizedBinomial(n, k float64) float64 {
	return math.Exp(LogGeneralizedBinomial(n, k))
}

// LogGeneralizedBinomial returns the log of the generalized binomial coefficient.
// See GeneralizedBinomial for more information.
func LogGeneralizedBinomial(n, k float64) float64 {
	if n < 0 || k < 0 {
		panic(errNegInput)
	}
	if n < k {
		panic(badSetSize)
	}
	a, _ := math.Lgamma(n + 1)
	b, _ := math.Lgamma(k + 1)
	c, _ := math.Lgamma(n - k + 1)
	return a - b - c
}

// CombinationGenerator generates combinations iteratively. The Combinations
// function may be called to generate all combinations collectively.
type CombinationGenerator struct {
	n         int
	k         int
	previous  []int
	remaining int
}

// NewCombinationGenerator returns a CombinationGenerator for generating the
// combinations of k elements from a set of size n.
//
// n and k must be non-negative with n >= k, otherwise NewCombinationGenerator
// will panic.
func NewCombinationGenerator(n, k int) *CombinationGenerator {
	return &CombinationGenerator{
		n:         n,
		k:         k,
		remaining: Binomial(n, k),
	}
}

// Next advances the iterator if there are combinations remaining to be generated,
// and returns false if all combinations have been generated. Next must be called
// to initialize the first value before calling Combination or Combination will
// panic. The value returned by Combination is only changed during calls to Next.
func (c *CombinationGenerator) Next() bool {
	if c.remaining <= 0 {
		// Next is called before combination, so c.remaining is set to zero before
		// Combination is called. Thus, Combination cannot panic on zero, and a
		// second sentinel value is needed.
		c.remaining = -1
		return false
	}
	if c.previous == nil {
		c.previous = make([]int, c.k)
		for i := range c.previous {
			c.previous[i] = i
		}
	} else {
		nextCombination(c.previous, c.n, c.k)
	}
	c.remaining--
	return true
}

// Combination returns the current combination. If dst is non-nil, it must have
// length k and the result will be stored in-place into dst. If dst
// is nil a new slice will be allocated and returned. If all of the combinations
// have already been constructed (Next() returns false), Combination will panic.
//
// Next must be called to initialize the first value before calling Combination
// or Combination will panic. The value returned by Combination is only changed
// during calls to Next.
func (c *CombinationGenerator) Combination(dst []int) []int {
	if c.remaining == -1 {
		panic("combin: all combinations have been generated")
	}
	if c.previous == nil {
		panic("combin: Combination called before Next")
	}
	if dst == nil {
		dst = make([]int, c.k)
	} else if len(dst) != c.k {
		panic(badInput)
	}
	copy(dst, c.previous)
	return dst
}

// Combinations generates all of the combinations of k elements from a
// set of size n. The returned slice has length Binomial(n,k) and each inner slice
// has length k.
//
// n and k must be non-negative with n >= k, otherwise Combinations will panic.
//
// CombinationGenerator may alternatively be used to generate the combinations
// iteratively instead of collectively, or IndexToCombination for random access.
func Combinations(n, k int) [][]int {
	combins := Binomial(n, k)
	data := make([][]int, combins)
	if len(data) == 0 {
		return data
	}
	data[0] = make([]int, k)
	for i := range data[0] {
		data[0][i] = i
	}
	for i := 1; i < combins; i++ {
		next := make([]int, k)
		copy(next, data[i-1])
		nextCombination(next, n, k)
		data[i] = next
	}
	return data
}

// nextCombination generates the combination after s, overwriting the input value.
func nextCombination(s []int, n, k int) {
	for j := k - 1; j >= 0; j-- {
		if s[j] == n+j-k {
			continue
		}
		s[j]++
		for l := j + 1; l < k; l++ {
			s[l] = s[j] + l - j
		}
		break
	}
}

// CombinationIndex returns the index of the given combination.
//
// The functions CombinationIndex and IndexToCombination define a bijection
// between the integers and the Binomial(n, k) number of possible combinations.
// CombinationIndex returns the inverse of IndexToCombination.
//
// CombinationIndex panics if comb is not a sorted combination of the first
// [0,n) integers, if n or k are negative, or if k is greater than n.
func CombinationIndex(comb []int, n, k int) int {
	if n < 0 || k < 0 {
		panic(errNegInput)
	}
	if n < k {
		panic(badSetSize)
	}
	if len(comb) != k {
		panic("combin: bad length combination")
	}
	if !sort.IntsAreSorted(comb) {
		panic("combin: input combination is not sorted")
	}
	contains := make(map[int]struct{}, k)
	for _, v := range comb {
		contains[v] = struct{}{}
	}
	if len(contains) != k {
		panic("combin: comb contains non-unique elements")
	}
	// This algorithm iterates in reverse lexicograhpic order.
	// Flip the index and values to swap the order.
	rev := make([]int, k)
	for i, v := range comb {
		rev[len(comb)-i-1] = n - v - 1
	}
	idx := 0
	for i, v := range rev {
		if v >= i+1 {
			idx += Binomial(v, i+1)
		}
	}
	return Binomial(n, k) - 1 - idx
}

// IndexToCombination returns the combination corresponding to the given index.
//
// The functions CombinationIndex and IndexToCombination define a bijection
// between the integers and the Binomial(n, k) number of possible combinations.
// IndexToCombination returns the inverse of CombinationIndex (up to the order
// of the elements).
//
// The combination is stored in-place into dst if dst is non-nil, otherwise
// a new slice is allocated and returned.
//
// IndexToCombination panics if n or k are negative, if k is greater than n,
// or if idx is not in [0, Binomial(n,k)-1]. IndexToCombination will also panic
// if dst is non-nil and len(dst) is not k.
func IndexToCombination(dst []int, idx, n, k int) []int {
	if idx < 0 || idx >= Binomial(n, k) {
		panic("combin: invalid index")
	}
	if dst == nil {
		dst = make([]int, k)
	} else if len(dst) != k {
		panic(badInput)
	}
	// The base algorithm indexes in reverse lexicographic order
	// flip the values and the index.
	idx = Binomial(n, k) - 1 - idx
	for i := range dst {
		// Find the largest number m such that Binomial(m, k-i) <= idx.
		// This is one less than the first number such that it is larger.
		m := sort.Search(n, func(m int) bool {
			if m < k-i {
				return false
			}
			return Binomial(m, k-i) > idx
		})
		m--
		// Normally this is put m into the last free spot, but we
		// reverse the index and the value.
		dst[i] = n - m - 1
		if m >= k-i {
			idx -= Binomial(m, k-i)
		}
	}
	return dst
}

// Cartesian returns the Cartesian product of the slices in data. The Cartesian
// product of two sets is the set of all combinations of the items. For example,
// given the input
//
//	[]int{2, 3, 1}
//
// the returned matrix will be
//
//	[ 0 0 0 ]
//	[ 0 1 0 ]
//	[ 0 2 0 ]
//	[ 1 0 0 ]
//	[ 1 1 0 ]
//	[ 1 2 0 ]
//
// Cartesian panics if any of the provided lengths are less than 1.
func Cartesian(lens []int) [][]int {
	rows := Card(lens)
	if rows == 0 {
		panic("combin: empty lengths")
	}
	out := make([][]int, rows)
	for i := 0; i < rows; i++ {
		out[i] = SubFor(nil, i, lens)
	}
	return out
}

// Card computes the cardinality of the multi-dimensional space whose dimensions have size specified by dims
// All length values must be positive, otherwise this will panic.
func Card(dims []int) int {
	if len(dims) == 0 {
		return 0
	}
	card := 1
	for _, v := range dims {
		if v < 0 {
			panic("combin: length less than zero")
		}
		card *= v
	}
	return card
}

// NewCartesianGenerator returns a CartesianGenerator for iterating over Cartesian products which are generated on the fly.
// All values in lens must be positive, otherwise this will panic.
func NewCartesianGenerator(lens []int) *CartesianGenerator {
	return &CartesianGenerator{
		lens: lens,
		rows: Card(lens),
		idx:  -1,
	}
}

// CartesianGenerator iterates over a Cartesian product set.
type CartesianGenerator struct {
	lens []int
	rows int
	idx  int
}

// Next moves to the next product of the Cartesian set.
// It returns false if the generator reached the end of the Cartesian set end.
func (g *CartesianGenerator) Next() bool {
	if g.idx+1 < g.rows {
		g.idx++
		return true
	}
	g.idx = g.rows
	return false
}

// Product generates one product of the Cartesian set according to the current index which is increased by Next().
// Next needs to be called at least one time before this method, otherwise it will panic.
func (g *CartesianGenerator) Product(dst []int) []int {
	return SubFor(dst, g.idx, g.lens)
}

// IdxFor converts a multi-dimensional index into a linear index for a
// multi-dimensional space. sub specifies the index for each dimension, and dims
// specifies the size of each dimension. IdxFor is the inverse of SubFor.
// IdxFor panics if any of the entries of sub are negative, any of the entries
// of dim are non-positive, or if sub[i] >= dims[i] for any i.
func IdxFor(sub, dims []int) int {
	// The index returned is "row-major", that is the last index of sub is
	// continuous.
	var idx int
	stride := 1
	for i := len(dims) - 1; i >= 0; i-- {
		v := sub[i]
		d := dims[i]
		if d <= 0 {
			panic(errNonpositiveDimension)
		}
		if v < 0 || v >= d {
			panic("combin: invalid subscript")
		}
		idx += v * stride
		stride *= d
	}
	return idx
}

// SubFor returns the multi-dimensional subscript for the input linear index to
// the multi-dimensional space. dims specifies the size of each dimension, and
// idx specifies the linear index. SubFor is the inverse of IdxFor.
//
// If sub is non-nil the result is stored in-place into sub, and SubFor will panic
// if len(sub) != len(dims). If sub is nil a new slice of the appropriate length
// is allocated. SubFor panics if idx < 0 or if idx is greater than or equal to
// the product of the dimensions.
func SubFor(sub []int, idx int, dims []int) []int {
	if sub == nil {
		sub = make([]int, len(dims))
	}
	if len(sub) != len(dims) {
		panic(badInput)
	}
	if idx < 0 {
		panic(errNegInput)
	}
	stride := 1
	for i := len(dims) - 1; i >= 1; i-- {
		stride *= dims[i]
	}
	for i := 0; i < len(dims)-1; i++ {
		v := idx / stride
		d := dims[i]
		if d < 0 {
			panic(errNonpositiveDimension)
		}
		if v >= dims[i] {
			panic("combin: index too large")
		}
		sub[i] = v
		idx -= v * stride
		stride /= dims[i+1]
	}
	if idx > dims[len(sub)-1] {
		panic("combin: index too large")
	}
	sub[len(sub)-1] = idx
	return sub
}

// NumPermutations returns the number of permutations when selecting k
// objects from a set of n objects when the selection order matters.
// No check is made for overflow.
//
// NumPermutations panics if either n or k is negative, or if k is
// greater than n.
func NumPermutations(n, k int) int {
	if n < 0 {
		panic("combin: n is negative")
	}
	if k < 0 {
		panic("combin: k is negative")
	}
	if k > n {
		panic("combin: k is greater than n")
	}
	p := 1
	for i := n - k + 1; i <= n; i++ {
		p *= i
	}
	return p
}

// Permutations generates all of the permutations of k elements from a
// set of size n. The returned slice has length NumPermutations(n, k)
// and each inner slice has length k.
//
// n and k must be non-negative with n >= k, otherwise Permutations will panic.
//
// PermutationGenerator may alternatively be used to generate the permutations
// iteratively instead of collectively, or IndexToPermutation for random access.
func Permutations(n, k int) [][]int {
	nPerms := NumPermutations(n, k)
	data := make([][]int, nPerms)
	if len(data) == 0 {
		return data
	}
	for i := 0; i < nPerms; i++ {
		data[i] = IndexToPermutation(nil, i, n, k)
	}
	return data
}

// PermutationGenerator generates permutations iteratively. The Permutations
// function may be called to generate all permutations collectively.
type PermutationGenerator struct {
	n           int
	k           int
	nPerm       int
	idx         int
	permutation []int
}

// NewPermutationGenerator returns a PermutationGenerator for generating the
// permutations of k elements from a set of size n.
//
// n and k must be non-negative with n >= k, otherwise NewPermutationGenerator
// will panic.
func NewPermutationGenerator(n, k int) *PermutationGenerator {
	return &PermutationGenerator{
		n:           n,
		k:           k,
		nPerm:       NumPermutations(n, k),
		idx:         -1,
		permutation: make([]int, k),
	}
}

// Next advances the iterator if there are permutations remaining to be generated,
// and returns false if all permutations have been generated. Next must be called
// to initialize the first value before calling Permutation or Permutation will
// panic. The value returned by Permutation is only changed during calls to Next.
func (p *PermutationGenerator) Next() bool {
	if p.idx >= p.nPerm-1 {
		p.idx = p.nPerm // so Permutation can panic.
		return false
	}
	p.idx++
	IndexToPermutation(p.permutation, p.idx, p.n, p.k)
	return true
}

// Permutation returns the current permutation. If dst is non-nil, it must have
// length k and the result will be stored in-place into dst. If dst
// is nil a new slice will be allocated and returned. If all of the permutations
// have already been constructed (Next() returns false), Permutation will panic.
//
// Next must be called to initialize the first value before calling Permutation
// or Permutation will panic. The value returned by Permutation is only changed
// during calls to Next.
func (p *PermutationGenerator) Permutation(dst []int) []int {
	if p.idx == p.nPerm {
		panic("combin: all permutations have been generated")
	}
	if p.idx == -1 {
		panic("combin: Permutation called before Next")
	}
	if dst == nil {
		dst = make([]int, p.k)
	} else if len(dst) != p.k {
		panic(badInput)
	}
	copy(dst, p.permutation)
	return dst
}

// PermutationIndex returns the index of the given permutation.
//
// The functions PermutationIndex and IndexToPermutation define a bijection
// between the integers and the NumPermutations(n, k) number of possible permutations.
// PermutationIndex returns the inverse of IndexToPermutation.
//
// PermutationIndex panics if perm is not a permutation of k of the first
// [0,n) integers, if n or k are negative, or if k is greater than n.
func PermutationIndex(perm []int, n, k int) int {
	if n < 0 || k < 0 {
		panic(errNegInput)
	}
	if n < k {
		panic(badSetSize)
	}
	if len(perm) != k {
		panic("combin: bad length permutation")
	}
	contains := make(map[int]struct{}, k)
	for _, v := range perm {
		if v < 0 || v >= n {
			panic("combin: bad element")
		}
		contains[v] = struct{}{}
	}
	if len(contains) != k {
		panic("combin: perm contains non-unique elements")
	}
	if n == k {
		// The permutation is the ordering of the elements.
		return equalPermutationIndex(perm)
	}

	// The permutation index is found by finding the combination index and the
	// equalPermutation index. The combination index is found by just sorting
	// the elements, and the permutation index is the ordering of the size
	// of the elements.
	tmp := make([]int, len(perm))
	copy(tmp, perm)
	idx := make([]int, len(perm))
	for i := range idx {
		idx[i] = i
	}
	s := sortInts{tmp, idx}
	sort.Sort(s)
	order := make([]int, len(perm))
	for i, v := range idx {
		order[v] = i
	}
	combIdx := CombinationIndex(tmp, n, k)
	permIdx := equalPermutationIndex(order)
	return combIdx*NumPermutations(k, k) + permIdx
}

type sortInts struct {
	data []int
	idx  []int
}

func (s sortInts) Len() int {
	return len(s.data)
}

func (s sortInts) Less(i, j int) bool {
	return s.data[i] < s.data[j]
}

func (s sortInts) Swap(i, j int) {
	s.data[i], s.data[j] = s.data[j], s.data[i]
	s.idx[i], s.idx[j] = s.idx[j], s.idx[i]
}

// IndexToPermutation returns the permutation corresponding to the given index.
//
// The functions PermutationIndex and IndexToPermutation define a bijection
// between the integers and the NumPermutations(n, k) number of possible permutations.
// IndexToPermutation returns the inverse of PermutationIndex.
//
// The permutation is stored in-place into dst if dst is non-nil, otherwise
// a new slice is allocated and returned.
//
// IndexToPermutation panics if n or k are negative, if k is greater than n,
// or if idx is not in [0, NumPermutations(n,k)-1]. IndexToPermutation will also panic
// if dst is non-nil and len(dst) is not k.
func IndexToPermutation(dst []int, idx, n, k int) []int {
	nPerm := NumPermutations(n, k)
	if idx < 0 || idx >= nPerm {
		panic("combin: invalid index")
	}
	if dst == nil {
		dst = make([]int, k)
	} else if len(dst) != k {
		panic(badInput)
	}
	if n == k {
		indexToEqualPermutation(dst, idx)
		return dst
	}

	// First, we index into the combination (which of the k items to choose)
	// and then we index into the n == k permutation of those k items. The
	// indexing acts like a matrix with nComb rows and factorial(k) columns.
	kPerm := NumPermutations(k, k)
	combIdx := idx / kPerm
	permIdx := idx % kPerm
	comb := IndexToCombination(nil, combIdx, n, k) // Gives us the set of integers.
	perm := make([]int, len(dst))
	indexToEqualPermutation(perm, permIdx) // Gives their order.
	for i, v := range perm {
		dst[i] = comb[v]
	}
	return dst
}

// equalPermutationIndex returns the index of the given permutation of the
// first k integers.
func equalPermutationIndex(perm []int) int {
	// Note(btracey): This is an n^2 algorithm, but factorial increases
	// very quickly (25! overflows int64) so this is not a problem in
	// practice.
	idx := 0
	for i, u := range perm {
		less := 0
		for _, v := range perm[i:] {
			if v < u {
				less++
			}
		}
		idx += less * factorial(len(perm)-i-1)
	}
	return idx
}

// indexToEqualPermutation returns the permutation for the first len(dst)
// integers for the given index.
func indexToEqualPermutation(dst []int, idx int) {
	for i := range dst {
		dst[i] = i
	}
	for i := range dst {
		f := factorial(len(dst) - i - 1)
		r := idx / f
		v := dst[i+r]
		copy(dst[i+1:i+r+1], dst[i:i+r])
		dst[i] = v
		idx %= f
	}
}

// factorial returns a!.
func factorial(a int) int {
	f := 1
	for i := 2; i <= a; i++ {
		f *= i
	}
	return f
}
