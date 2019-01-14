// Copyright 2015 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package promql

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/labels"
)

// Function represents a function of the expression language and is
// used by function nodes.
type Function struct {
	Name       string
	ArgTypes   []ValueType
	Variadic   int
	ReturnType ValueType

	// vals is a list of the evaluated arguments for the function call.
	//    For range vectors it will be a Matrix with one series, instant vectors a
	//    Vector, scalars a Vector with one series whose value is the scalar
	//    value,and nil for strings.
	// args are the original arguments to the function, where you can access
	//    matrixSelectors, vectorSelectors, and StringLiterals.
	// enh.out is a pre-allocated empty vector that you may use to accumulate
	//    output before returning it. The vectors in vals should not be returned.a
	// Range vector functions need only return a vector with the right value,
	//     the metric and timestamp are not needed.
	// Instant vector functions need only return a vector with the right values and
	//     metrics, the timestamp are not needed.
	// Scalar results should be returned as the value of a sample in a Vector.
	Call func(vals []Value, args Expressions, enh *EvalNodeHelper) Vector
}

// === time() float64 ===
func funcTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return Vector{Sample{Point: Point{
		V: float64(enh.ts) / 1000,
	}}}
}

// extrapolatedRate is a utility function for rate/increase/delta.
// It calculates the rate (allowing for counter resets if isCounter is true),
// extrapolates if the first/last sample is close to the boundary, and returns
// the result as either per-second (if isRate is true) or overall.
func extrapolatedRate(vals []Value, args Expressions, enh *EvalNodeHelper, isCounter bool, isRate bool) Vector {
	ms := args[0].(*MatrixSelector)

	var (
		matrix     = vals[0].(Matrix)
		rangeStart = enh.ts - durationMilliseconds(ms.Range+ms.Offset)
		rangeEnd   = enh.ts - durationMilliseconds(ms.Offset)
	)

	for _, samples := range matrix {
		// No sense in trying to compute a rate without at least two points. Drop
		// this Vector element.
		if len(samples.Points) < 2 {
			continue
		}
		var (
			counterCorrection float64
			lastValue         float64
		)
		for _, sample := range samples.Points {
			if isCounter && sample.V < lastValue {
				counterCorrection += lastValue
			}
			lastValue = sample.V
		}
		resultValue := lastValue - samples.Points[0].V + counterCorrection

		// Duration between first/last samples and boundary of range.
		durationToStart := float64(samples.Points[0].T-rangeStart) / 1000
		durationToEnd := float64(rangeEnd-samples.Points[len(samples.Points)-1].T) / 1000

		sampledInterval := float64(samples.Points[len(samples.Points)-1].T-samples.Points[0].T) / 1000
		averageDurationBetweenSamples := sampledInterval / float64(len(samples.Points)-1)

		if isCounter && resultValue > 0 && samples.Points[0].V >= 0 {
			// Counters cannot be negative. If we have any slope at
			// all (i.e. resultValue went up), we can extrapolate
			// the zero point of the counter. If the duration to the
			// zero point is shorter than the durationToStart, we
			// take the zero point as the start of the series,
			// thereby avoiding extrapolation to negative counter
			// values.
			durationToZero := sampledInterval * (samples.Points[0].V / resultValue)
			if durationToZero < durationToStart {
				durationToStart = durationToZero
			}
		}

		// If the first/last samples are close to the boundaries of the range,
		// extrapolate the result. This is as we expect that another sample
		// will exist given the spacing between samples we've seen thus far,
		// with an allowance for noise.
		extrapolationThreshold := averageDurationBetweenSamples * 1.1
		extrapolateToInterval := sampledInterval

		if durationToStart < extrapolationThreshold {
			extrapolateToInterval += durationToStart
		} else {
			extrapolateToInterval += averageDurationBetweenSamples / 2
		}
		if durationToEnd < extrapolationThreshold {
			extrapolateToInterval += durationToEnd
		} else {
			extrapolateToInterval += averageDurationBetweenSamples / 2
		}
		resultValue = resultValue * (extrapolateToInterval / sampledInterval)
		if isRate {
			resultValue = resultValue / ms.Range.Seconds()
		}

		enh.out = append(enh.out, Sample{
			Point: Point{V: resultValue},
		})
	}
	return enh.out
}

// === delta(Matrix ValueTypeMatrix) Vector ===
func funcDelta(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return extrapolatedRate(vals, args, enh, false, false)
}

// === rate(node ValueTypeMatrix) Vector ===
func funcRate(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return extrapolatedRate(vals, args, enh, true, true)
}

// === increase(node ValueTypeMatrix) Vector ===
func funcIncrease(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return extrapolatedRate(vals, args, enh, true, false)
}

// === irate(node ValueTypeMatrix) Vector ===
func funcIrate(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return instantValue(vals, enh.out, true)
}

// === idelta(node model.ValMatric) Vector ===
func funcIdelta(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return instantValue(vals, enh.out, false)
}

func instantValue(vals []Value, out Vector, isRate bool) Vector {
	for _, samples := range vals[0].(Matrix) {
		// No sense in trying to compute a rate without at least two points. Drop
		// this Vector element.
		if len(samples.Points) < 2 {
			continue
		}

		lastSample := samples.Points[len(samples.Points)-1]
		previousSample := samples.Points[len(samples.Points)-2]

		var resultValue float64
		if isRate && lastSample.V < previousSample.V {
			// Counter reset.
			resultValue = lastSample.V
		} else {
			resultValue = lastSample.V - previousSample.V
		}

		sampledInterval := lastSample.T - previousSample.T
		if sampledInterval == 0 {
			// Avoid dividing by 0.
			continue
		}

		if isRate {
			// Convert to per-second.
			resultValue /= float64(sampledInterval) / 1000
		}

		out = append(out, Sample{
			Point: Point{V: resultValue},
		})
	}
	return out
}

// Calculate the trend value at the given index i in raw data d.
// This is somewhat analogous to the slope of the trend at the given index.
// The argument "s" is the set of computed smoothed values.
// The argument "b" is the set of computed trend factors.
// The argument "d" is the set of raw input values.
func calcTrendValue(i int, sf, tf, s0, s1, b float64) float64 {
	if i == 0 {
		return b
	}

	x := tf * (s1 - s0)
	y := (1 - tf) * b

	return x + y
}

// Holt-Winters is similar to a weighted moving average, where historical data has exponentially less influence on the current data.
// Holt-Winter also accounts for trends in data. The smoothing factor (0 < sf < 1) affects how historical data will affect the current
// data. A lower smoothing factor increases the influence of historical data. The trend factor (0 < tf < 1) affects
// how trends in historical data will affect the current data. A higher trend factor increases the influence.
// of trends. Algorithm taken from https://en.wikipedia.org/wiki/Exponential_smoothing titled: "Double exponential smoothing".
func funcHoltWinters(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	mat := vals[0].(Matrix)

	// The smoothing factor argument.
	sf := vals[1].(Vector)[0].V

	// The trend factor argument.
	tf := vals[2].(Vector)[0].V

	// Sanity check the input.
	if sf <= 0 || sf >= 1 {
		panic(fmt.Errorf("invalid smoothing factor. Expected: 0 < sf < 1, got: %f", sf))
	}
	if tf <= 0 || tf >= 1 {
		panic(fmt.Errorf("invalid trend factor. Expected: 0 < tf < 1, got: %f", tf))
	}

	var l int
	for _, samples := range mat {
		l = len(samples.Points)

		// Can't do the smoothing operation with less than two points.
		if l < 2 {
			continue
		}

		var s0, s1, b float64
		// Set initial values.
		s1 = samples.Points[0].V
		b = samples.Points[1].V - samples.Points[0].V

		// Run the smoothing operation.
		var x, y float64
		for i := 1; i < l; i++ {

			// Scale the raw value against the smoothing factor.
			x = sf * samples.Points[i].V

			// Scale the last smoothed value with the trend at this point.
			b = calcTrendValue(i-1, sf, tf, s0, s1, b)
			y = (1 - sf) * (s1 + b)

			s0, s1 = s1, x+y
		}

		enh.out = append(enh.out, Sample{
			Point: Point{V: s1},
		})
	}

	return enh.out
}

// === sort(node ValueTypeVector) Vector ===
func funcSort(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	// NaN should sort to the bottom, so take descending sort with NaN first and
	// reverse it.
	byValueSorter := vectorByReverseValueHeap(vals[0].(Vector))
	sort.Sort(sort.Reverse(byValueSorter))
	return Vector(byValueSorter)
}

// === sortDesc(node ValueTypeVector) Vector ===
func funcSortDesc(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	// NaN should sort to the bottom, so take ascending sort with NaN first and
	// reverse it.
	byValueSorter := vectorByValueHeap(vals[0].(Vector))
	sort.Sort(sort.Reverse(byValueSorter))
	return Vector(byValueSorter)
}

// === clamp_max(Vector ValueTypeVector, max Scalar) Vector ===
func funcClampMax(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	vec := vals[0].(Vector)
	max := vals[1].(Vector)[0].Point.V
	for _, el := range vec {
		enh.out = append(enh.out, Sample{
			Metric: enh.dropMetricName(el.Metric),
			Point:  Point{V: math.Min(max, el.V)},
		})
	}
	return enh.out
}

// === clamp_min(Vector ValueTypeVector, min Scalar) Vector ===
func funcClampMin(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	vec := vals[0].(Vector)
	min := vals[1].(Vector)[0].Point.V
	for _, el := range vec {
		enh.out = append(enh.out, Sample{
			Metric: enh.dropMetricName(el.Metric),
			Point:  Point{V: math.Max(min, el.V)},
		})
	}
	return enh.out
}

// === round(Vector ValueTypeVector, toNearest=1 Scalar) Vector ===
func funcRound(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	vec := vals[0].(Vector)
	// round returns a number rounded to toNearest.
	// Ties are solved by rounding up.
	toNearest := float64(1)
	if len(args) >= 2 {
		toNearest = vals[1].(Vector)[0].Point.V
	}
	// Invert as it seems to cause fewer floating point accuracy issues.
	toNearestInverse := 1.0 / toNearest

	for _, el := range vec {
		v := math.Floor(el.V*toNearestInverse+0.5) / toNearestInverse
		enh.out = append(enh.out, Sample{
			Metric: enh.dropMetricName(el.Metric),
			Point:  Point{V: v},
		})
	}
	return enh.out
}

// === Scalar(node ValueTypeVector) Scalar ===
func funcScalar(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	v := vals[0].(Vector)
	if len(v) != 1 {
		return append(enh.out, Sample{
			Point: Point{V: math.NaN()},
		})
	}
	return append(enh.out, Sample{
		Point: Point{V: v[0].V},
	})
}

func aggrOverTime(vals []Value, enh *EvalNodeHelper, aggrFn func([]Point) float64) Vector {
	mat := vals[0].(Matrix)

	for _, el := range mat {
		if len(el.Points) == 0 {
			continue
		}

		enh.out = append(enh.out, Sample{
			Point: Point{V: aggrFn(el.Points)},
		})
	}
	return enh.out
}

// === avg_over_time(Matrix ValueTypeMatrix) Vector ===
func funcAvgOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		var mean, count float64
		for _, v := range values {
			count++
			mean += (v.V - mean) / count
		}
		return mean
	})
}

// === count_over_time(Matrix ValueTypeMatrix) Vector ===
func funcCountOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		return float64(len(values))
	})
}

// === floor(Vector ValueTypeVector) Vector ===
// === max_over_time(Matrix ValueTypeMatrix) Vector ===
func funcMaxOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		max := values[0].V
		for _, v := range values {
			if v.V > max || math.IsNaN(max) {
				max = v.V
			}
		}
		return max
	})
}

// === min_over_time(Matrix ValueTypeMatrix) Vector ===
func funcMinOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		min := values[0].V
		for _, v := range values {
			if v.V < min || math.IsNaN(min) {
				min = v.V
			}
		}
		return min
	})
}

// === sum_over_time(Matrix ValueTypeMatrix) Vector ===
func funcSumOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		var sum float64
		for _, v := range values {
			sum += v.V
		}
		return sum
	})
}

// === quantile_over_time(Matrix ValueTypeMatrix) Vector ===
func funcQuantileOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	q := vals[0].(Vector)[0].V
	mat := vals[1].(Matrix)

	for _, el := range mat {
		if len(el.Points) == 0 {
			continue
		}

		values := make(vectorByValueHeap, 0, len(el.Points))
		for _, v := range el.Points {
			values = append(values, Sample{Point: Point{V: v.V}})
		}
		enh.out = append(enh.out, Sample{
			Point: Point{V: quantile(q, values)},
		})
	}
	return enh.out
}

// === stddev_over_time(Matrix ValueTypeMatrix) Vector ===
func funcStddevOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		var aux, count, mean float64
		for _, v := range values {
			count++
			delta := v.V - mean
			mean += delta / count
			aux += delta * (v.V - mean)
		}
		return math.Sqrt(aux / count)
	})
}

// === stdvar_over_time(Matrix ValueTypeMatrix) Vector ===
func funcStdvarOverTime(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		var aux, count, mean float64
		for _, v := range values {
			count++
			delta := v.V - mean
			mean += delta / count
			aux += delta * (v.V - mean)
		}
		return aux / count
	})
}

// === absent(Vector ValueTypeVector) Vector ===
func funcAbsent(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	if len(vals[0].(Vector)) > 0 {
		return enh.out
	}
	m := []labels.Label{}

	if vs, ok := args[0].(*VectorSelector); ok {
		for _, ma := range vs.LabelMatchers {
			if ma.Type == labels.MatchEqual && ma.Name != labels.MetricName {
				m = append(m, labels.Label{Name: ma.Name, Value: ma.Value})
			}
		}
	}
	return append(enh.out,
		Sample{
			Metric: labels.New(m...),
			Point:  Point{V: 1},
		})
}

func simpleFunc(vals []Value, enh *EvalNodeHelper, f func(float64) float64) Vector {
	for _, el := range vals[0].(Vector) {
		enh.out = append(enh.out, Sample{
			Metric: enh.dropMetricName(el.Metric),
			Point:  Point{V: f(el.V)},
		})
	}
	return enh.out
}

// === abs(Vector ValueTypeVector) Vector ===
func funcAbs(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Abs)
}

// === ceil(Vector ValueTypeVector) Vector ===
func funcCeil(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Ceil)
}

// === floor(Vector ValueTypeVector) Vector ===
func funcFloor(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Floor)
}

// === exp(Vector ValueTypeVector) Vector ===
func funcExp(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Exp)
}

// === sqrt(Vector VectorNode) Vector ===
func funcSqrt(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Sqrt)
}

// === ln(Vector ValueTypeVector) Vector ===
func funcLn(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Log)
}

// === log2(Vector ValueTypeVector) Vector ===
func funcLog2(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Log2)
}

// === log10(Vector ValueTypeVector) Vector ===
func funcLog10(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Log10)
}

// === timestamp(Vector ValueTypeVector) Vector ===
func funcTimestamp(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	vec := vals[0].(Vector)
	for _, el := range vec {
		enh.out = append(enh.out, Sample{
			Metric: enh.dropMetricName(el.Metric),
			Point:  Point{V: float64(el.T) / 1000},
		})
	}
	return enh.out
}

// linearRegression performs a least-square linear regression analysis on the
// provided SamplePairs. It returns the slope, and the intercept value at the
// provided time.
func linearRegression(samples []Point, interceptTime int64) (slope, intercept float64) {
	var (
		n            float64
		sumX, sumY   float64
		sumXY, sumX2 float64
	)
	for _, sample := range samples {
		x := float64(sample.T-interceptTime) / 1e3
		n += 1.0
		sumY += sample.V
		sumX += x
		sumXY += x * sample.V
		sumX2 += x * x
	}
	covXY := sumXY - sumX*sumY/n
	varX := sumX2 - sumX*sumX/n

	slope = covXY / varX
	intercept = sumY/n - slope*sumX/n
	return slope, intercept
}

// === deriv(node ValueTypeMatrix) Vector ===
func funcDeriv(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	mat := vals[0].(Matrix)

	for _, samples := range mat {
		// No sense in trying to compute a derivative without at least two points.
		// Drop this Vector element.
		if len(samples.Points) < 2 {
			continue
		}

		// We pass in an arbitrary timestamp that is near the values in use
		// to avoid floating point accuracy issues, see
		// https://github.com/prometheus/prometheus/issues/2674
		slope, _ := linearRegression(samples.Points, samples.Points[0].T)
		enh.out = append(enh.out, Sample{
			Point: Point{V: slope},
		})
	}
	return enh.out
}

// === predict_linear(node ValueTypeMatrix, k ValueTypeScalar) Vector ===
func funcPredictLinear(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	mat := vals[0].(Matrix)
	duration := vals[1].(Vector)[0].V

	for _, samples := range mat {
		// No sense in trying to predict anything without at least two points.
		// Drop this Vector element.
		if len(samples.Points) < 2 {
			continue
		}
		slope, intercept := linearRegression(samples.Points, enh.ts)

		enh.out = append(enh.out, Sample{
			Point: Point{V: slope*duration + intercept},
		})
	}
	return enh.out
}

// === histogram_quantile(k ValueTypeScalar, Vector ValueTypeVector) Vector ===
func funcHistogramQuantile(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	q := vals[0].(Vector)[0].V
	inVec := vals[1].(Vector)
	sigf := enh.signatureFunc(false, excludedLabels...)

	if enh.signatureToMetricWithBuckets == nil {
		enh.signatureToMetricWithBuckets = map[uint64]*metricWithBuckets{}
	} else {
		for _, v := range enh.signatureToMetricWithBuckets {
			v.buckets = v.buckets[:0]
		}
	}
	for _, el := range inVec {
		upperBound, err := strconv.ParseFloat(
			el.Metric.Get(model.BucketLabel), 64,
		)
		if err != nil {
			// Oops, no bucket label or malformed label value. Skip.
			// TODO(beorn7): Issue a warning somehow.
			continue
		}
		hash := sigf(el.Metric)

		mb, ok := enh.signatureToMetricWithBuckets[hash]
		if !ok {
			el.Metric = labels.NewBuilder(el.Metric).
				Del(labels.BucketLabel, labels.MetricName).
				Labels()

			mb = &metricWithBuckets{el.Metric, nil}
			enh.signatureToMetricWithBuckets[hash] = mb
		}
		mb.buckets = append(mb.buckets, bucket{upperBound, el.V})
	}

	for _, mb := range enh.signatureToMetricWithBuckets {
		if len(mb.buckets) > 0 {
			enh.out = append(enh.out, Sample{
				Metric: mb.metric,
				Point:  Point{V: bucketQuantile(q, mb.buckets)},
			})
		}
	}

	return enh.out
}

// === resets(Matrix ValueTypeMatrix) Vector ===
func funcResets(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	in := vals[0].(Matrix)

	for _, samples := range in {
		resets := 0
		prev := samples.Points[0].V
		for _, sample := range samples.Points[1:] {
			current := sample.V
			if current < prev {
				resets++
			}
			prev = current
		}

		enh.out = append(enh.out, Sample{
			Point: Point{V: float64(resets)},
		})
	}
	return enh.out
}

// === changes(Matrix ValueTypeMatrix) Vector ===
func funcChanges(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	in := vals[0].(Matrix)

	for _, samples := range in {
		changes := 0
		prev := samples.Points[0].V
		for _, sample := range samples.Points[1:] {
			current := sample.V
			if current != prev && !(math.IsNaN(current) && math.IsNaN(prev)) {
				changes++
			}
			prev = current
		}

		enh.out = append(enh.out, Sample{
			Point: Point{V: float64(changes)},
		})
	}
	return enh.out
}

// === label_replace(Vector ValueTypeVector, dst_label, replacement, src_labelname, regex ValueTypeString) Vector ===
func funcLabelReplace(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	var (
		vector   = vals[0].(Vector)
		dst      = args[1].(*StringLiteral).Val
		repl     = args[2].(*StringLiteral).Val
		src      = args[3].(*StringLiteral).Val
		regexStr = args[4].(*StringLiteral).Val
	)

	if enh.regex == nil {
		var err error
		enh.regex, err = regexp.Compile("^(?:" + regexStr + ")$")
		if err != nil {
			panic(fmt.Errorf("invalid regular expression in label_replace(): %s", regexStr))
		}
		if !model.LabelNameRE.MatchString(dst) {
			panic(fmt.Errorf("invalid destination label name in label_replace(): %s", dst))
		}
		enh.dmn = make(map[uint64]labels.Labels, len(enh.out))
	}

	for _, el := range vector {
		h := el.Metric.Hash()
		var outMetric labels.Labels
		if l, ok := enh.dmn[h]; ok {
			outMetric = l
		} else {
			srcVal := el.Metric.Get(src)
			indexes := enh.regex.FindStringSubmatchIndex(srcVal)
			if indexes == nil {
				// If there is no match, no replacement should take place.
				outMetric = el.Metric
				enh.dmn[h] = outMetric
			} else {
				res := enh.regex.ExpandString([]byte{}, repl, srcVal, indexes)

				lb := labels.NewBuilder(el.Metric).Del(dst)
				if len(res) > 0 {
					lb.Set(dst, string(res))
				}
				outMetric = lb.Labels()
				enh.dmn[h] = outMetric
			}
		}

		enh.out = append(enh.out, Sample{
			Metric: outMetric,
			Point:  Point{V: el.Point.V},
		})
	}
	return enh.out
}

// === Vector(s Scalar) Vector ===
func funcVector(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return append(enh.out,
		Sample{
			Metric: labels.Labels{},
			Point:  Point{V: vals[0].(Vector)[0].V},
		})
}

// === label_join(vector model.ValVector, dest_labelname, separator, src_labelname...) Vector ===
func funcLabelJoin(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	var (
		vector    = vals[0].(Vector)
		dst       = args[1].(*StringLiteral).Val
		sep       = args[2].(*StringLiteral).Val
		srcLabels = make([]string, len(args)-3)
	)

	if enh.dmn == nil {
		enh.dmn = make(map[uint64]labels.Labels, len(enh.out))
	}

	for i := 3; i < len(args); i++ {
		src := args[i].(*StringLiteral).Val
		if !model.LabelName(src).IsValid() {
			panic(fmt.Errorf("invalid source label name in label_join(): %s", src))
		}
		srcLabels[i-3] = src
	}

	if !model.LabelName(dst).IsValid() {
		panic(fmt.Errorf("invalid destination label name in label_join(): %s", dst))
	}

	srcVals := make([]string, len(srcLabels))
	for _, el := range vector {
		h := el.Metric.Hash()
		var outMetric labels.Labels
		if l, ok := enh.dmn[h]; ok {
			outMetric = l
		} else {

			for i, src := range srcLabels {
				srcVals[i] = el.Metric.Get(src)
			}

			lb := labels.NewBuilder(el.Metric)

			strval := strings.Join(srcVals, sep)
			if strval == "" {
				lb.Del(dst)
			} else {
				lb.Set(dst, strval)
			}

			outMetric = lb.Labels()
			enh.dmn[h] = outMetric
		}

		enh.out = append(enh.out, Sample{
			Metric: outMetric,
			Point:  Point{V: el.Point.V},
		})
	}
	return enh.out
}

// Common code for date related functions.
func dateWrapper(vals []Value, enh *EvalNodeHelper, f func(time.Time) float64) Vector {
	if len(vals) == 0 {
		return append(enh.out,
			Sample{
				Metric: labels.Labels{},
				Point:  Point{V: f(time.Unix(enh.ts/1000, 0).UTC())},
			})
	}

	for _, el := range vals[0].(Vector) {
		t := time.Unix(int64(el.V), 0).UTC()
		enh.out = append(enh.out, Sample{
			Metric: enh.dropMetricName(el.Metric),
			Point:  Point{V: f(t)},
		})
	}
	return enh.out
}

// === days_in_month(v Vector) Scalar ===
func funcDaysInMonth(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(32 - time.Date(t.Year(), t.Month(), 32, 0, 0, 0, 0, time.UTC).Day())
	})
}

// === day_of_month(v Vector) Scalar ===
func funcDayOfMonth(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Day())
	})
}

// === day_of_week(v Vector) Scalar ===
func funcDayOfWeek(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Weekday())
	})
}

// === hour(v Vector) Scalar ===
func funcHour(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Hour())
	})
}

// === minute(v Vector) Scalar ===
func funcMinute(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Minute())
	})
}

// === month(v Vector) Scalar ===
func funcMonth(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Month())
	})
}

// === year(v Vector) Scalar ===
func funcYear(vals []Value, args Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Year())
	})
}

var functions = map[string]*Function{
	"abs": {
		Name:       "abs",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcAbs,
	},
	"absent": {
		Name:       "absent",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcAbsent,
	},
	"avg_over_time": {
		Name:       "avg_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcAvgOverTime,
	},
	"ceil": {
		Name:       "ceil",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcCeil,
	},
	"changes": {
		Name:       "changes",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcChanges,
	},
	"clamp_max": {
		Name:       "clamp_max",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeScalar},
		ReturnType: ValueTypeVector,
		Call:       funcClampMax,
	},
	"clamp_min": {
		Name:       "clamp_min",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeScalar},
		ReturnType: ValueTypeVector,
		Call:       funcClampMin,
	},
	"count_over_time": {
		Name:       "count_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcCountOverTime,
	},
	"days_in_month": {
		Name:       "days_in_month",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcDaysInMonth,
	},
	"day_of_month": {
		Name:       "day_of_month",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcDayOfMonth,
	},
	"day_of_week": {
		Name:       "day_of_week",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcDayOfWeek,
	},
	"delta": {
		Name:       "delta",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcDelta,
	},
	"deriv": {
		Name:       "deriv",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcDeriv,
	},
	"exp": {
		Name:       "exp",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcExp,
	},
	"floor": {
		Name:       "floor",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcFloor,
	},
	"histogram_quantile": {
		Name:       "histogram_quantile",
		ArgTypes:   []ValueType{ValueTypeScalar, ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcHistogramQuantile,
	},
	"holt_winters": {
		Name:       "holt_winters",
		ArgTypes:   []ValueType{ValueTypeMatrix, ValueTypeScalar, ValueTypeScalar},
		ReturnType: ValueTypeVector,
		Call:       funcHoltWinters,
	},
	"hour": {
		Name:       "hour",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcHour,
	},
	"idelta": {
		Name:       "idelta",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcIdelta,
	},
	"increase": {
		Name:       "increase",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcIncrease,
	},
	"irate": {
		Name:       "irate",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcIrate,
	},
	"label_replace": {
		Name:       "label_replace",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeString, ValueTypeString, ValueTypeString, ValueTypeString},
		ReturnType: ValueTypeVector,
		Call:       funcLabelReplace,
	},
	"label_join": {
		Name:       "label_join",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeString, ValueTypeString, ValueTypeString},
		Variadic:   -1,
		ReturnType: ValueTypeVector,
		Call:       funcLabelJoin,
	},
	"ln": {
		Name:       "ln",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcLn,
	},
	"log10": {
		Name:       "log10",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcLog10,
	},
	"log2": {
		Name:       "log2",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcLog2,
	},
	"max_over_time": {
		Name:       "max_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcMaxOverTime,
	},
	"min_over_time": {
		Name:       "min_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcMinOverTime,
	},
	"minute": {
		Name:       "minute",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcMinute,
	},
	"month": {
		Name:       "month",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcMonth,
	},
	"predict_linear": {
		Name:       "predict_linear",
		ArgTypes:   []ValueType{ValueTypeMatrix, ValueTypeScalar},
		ReturnType: ValueTypeVector,
		Call:       funcPredictLinear,
	},
	"quantile_over_time": {
		Name:       "quantile_over_time",
		ArgTypes:   []ValueType{ValueTypeScalar, ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcQuantileOverTime,
	},
	"rate": {
		Name:       "rate",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcRate,
	},
	"resets": {
		Name:       "resets",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcResets,
	},
	"round": {
		Name:       "round",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeScalar},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcRound,
	},
	"scalar": {
		Name:       "scalar",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeScalar,
		Call:       funcScalar,
	},
	"sort": {
		Name:       "sort",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcSort,
	},
	"sort_desc": {
		Name:       "sort_desc",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcSortDesc,
	},
	"sqrt": {
		Name:       "sqrt",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcSqrt,
	},
	"stddev_over_time": {
		Name:       "stddev_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcStddevOverTime,
	},
	"stdvar_over_time": {
		Name:       "stdvar_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcStdvarOverTime,
	},
	"sum_over_time": {
		Name:       "sum_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
		Call:       funcSumOverTime,
	},
	"time": {
		Name:       "time",
		ArgTypes:   []ValueType{},
		ReturnType: ValueTypeScalar,
		Call:       funcTime,
	},
	"timestamp": {
		Name:       "timestamp",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
		Call:       funcTimestamp,
	},
	"vector": {
		Name:       "vector",
		ArgTypes:   []ValueType{ValueTypeScalar},
		ReturnType: ValueTypeVector,
		Call:       funcVector,
	},
	"year": {
		Name:       "year",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
		Call:       funcYear,
	},
}

// getFunction returns a predefined Function object for the given name.
func getFunction(name string) (*Function, bool) {
	function, ok := functions[name]
	return function, ok
}

type vectorByValueHeap Vector

func (s vectorByValueHeap) Len() int {
	return len(s)
}

func (s vectorByValueHeap) Less(i, j int) bool {
	if math.IsNaN(s[i].V) {
		return true
	}
	return s[i].V < s[j].V
}

func (s vectorByValueHeap) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s *vectorByValueHeap) Push(x interface{}) {
	*s = append(*s, *(x.(*Sample)))
}

func (s *vectorByValueHeap) Pop() interface{} {
	old := *s
	n := len(old)
	el := old[n-1]
	*s = old[0 : n-1]
	return el
}

type vectorByReverseValueHeap Vector

func (s vectorByReverseValueHeap) Len() int {
	return len(s)
}

func (s vectorByReverseValueHeap) Less(i, j int) bool {
	if math.IsNaN(s[i].V) {
		return true
	}
	return s[i].V > s[j].V
}

func (s vectorByReverseValueHeap) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s *vectorByReverseValueHeap) Push(x interface{}) {
	*s = append(*s, *(x.(*Sample)))
}

func (s *vectorByReverseValueHeap) Pop() interface{} {
	old := *s
	n := len(old)
	el := old[n-1]
	*s = old[0 : n-1]
	return el
}
