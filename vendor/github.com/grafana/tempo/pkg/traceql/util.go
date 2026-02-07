package traceql

import (
	"math"
	"time"

	"github.com/grafana/tempo/pkg/tempopb"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("pkg/traceql")

func MakeCollectTagValueFunc(collect func(tempopb.TagValue) bool) func(v Static) bool {
	return func(v Static) bool {
		tv := tempopb.TagValue{}

		switch v.Type {
		case TypeString:
			tv.Type = "string"
			tv.Value = v.EncodeToString(false) // avoid formatting

		case TypeBoolean:
			tv.Type = "bool"
			tv.Value = v.String()

		case TypeInt:
			tv.Type = "int"
			tv.Value = v.String()

		case TypeFloat:
			tv.Type = "float"
			tv.Value = v.String()

		case TypeDuration:
			tv.Type = duration
			tv.Value = v.String()

		case TypeStatus:
			tv.Type = "keyword"
			tv.Value = v.String()
		}

		return collect(tv)
	}
}

// bucketSet is a simple set of buckets that can be used to track the number of exemplars
type bucketSet struct {
	sz, maxTotal, maxBucket int
	buckets                 []int
}

func newBucketSet(size int) *bucketSet {
	return &bucketSet{
		sz:        size,
		maxTotal:  maxExemplars,
		maxBucket: maxExemplarsPerBucket,
		buckets:   make([]int, size+1), // +1 for total count
	}
}

func (b *bucketSet) len() int {
	return b.buckets[b.sz]
}

func (b *bucketSet) testTotal() bool {
	return b.len() >= b.maxTotal
}

func (b *bucketSet) inRange(i int) bool {
	return i >= 0 && i < b.sz
}

func (b *bucketSet) addAndTest(i int) bool {
	if !b.inRange(i) || b.testTotal() {
		return true
	}

	if b.buckets[i] >= b.maxBucket {
		return true
	}

	b.buckets[i]++
	b.buckets[b.sz]++
	return false
}

const (
	leftBranch  = 0
	rightBranch = 1
)

type branchOptimizer struct {
	start            time.Time
	last             []time.Duration
	totals           []time.Duration
	Recording        bool
	samplesRemaining int
}

func newBranchPredictor(numBranches int, numSamples int) branchOptimizer {
	return branchOptimizer{
		totals:           make([]time.Duration, numBranches),
		last:             make([]time.Duration, numBranches),
		samplesRemaining: numSamples,
		Recording:        true,
	}
}

// Start recording. Should be called immediately prior to a branch execution.
func (b *branchOptimizer) Start() {
	b.start = time.Now()
}

// Finish the recording and temporarily save the cost for the given branch number.
func (b *branchOptimizer) Finish(branch int) {
	b.last[branch] = time.Since(b.start)
}

// Penalize the given branch using it's previously recorded cost.  This is called after
// executing all branches and then knowing in retrospect which ones were not needed.
func (b *branchOptimizer) Penalize(branch int) {
	b.totals[branch] += b.last[branch]
}

// Sampled indicates that a full execution was done and see if we have enough samples.
func (b *branchOptimizer) Sampled() (done bool) {
	b.samplesRemaining--
	b.Recording = b.samplesRemaining > 0
	return !b.Recording
}

// OptimalBranch returns the branch with the least penalized cost over time, i.e. the optimal one to start with.
func (b *branchOptimizer) OptimalBranch() int {
	mini := 0
	min := b.totals[0]
	for i := 1; i < len(b.totals); i++ {
		if b.totals[i] < min {
			mini = i
			min = b.totals[i]
		}
	}
	return mini
}

func kahanSumInc(inc, sum, c float64) (newSum, newC float64) {
	t := sum + inc
	switch {
	case math.IsInf(t, 0):
		c = 0

	// Using Neumaier improvement, swap if next term larger than sum.
	case math.Abs(sum) >= math.Abs(inc):
		c += (sum - t) + inc
	default:
		c += (inc - t) + sum
	}
	return t, c
}
