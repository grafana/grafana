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
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/promql/parser"
)

// FunctionCall is the type of a PromQL function implementation
//
// vals is a list of the evaluated arguments for the function call.
//    For range vectors it will be a Matrix with one series, instant vectors a
//    Vector, scalars a Vector with one series whose value is the scalar
//    value,and nil for strings.
// args are the original arguments to the function, where you can access
//    matrixSelectors, vectorSelectors, and StringLiterals.
// enh.Out is a pre-allocated empty vector that you may use to accumulate
//    output before returning it. The vectors in vals should not be returned.a
// Range vector functions need only return a vector with the right value,
//     the metric and timestamp are not needed.
// Instant vector functions need only return a vector with the right values and
//     metrics, the timestamp are not needed.
// Scalar results should be returned as the value of a sample in a Vector.
type FunctionCall func(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector

// === time() float64 ===
func funcTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return Vector{Sample{Point: Point{
		V: float64(enh.Ts) / 1000,
	}}}
}

// extrapolatedRate is a utility function for rate/increase/delta.
// It calculates the rate (allowing for counter resets if isCounter is true),
// extrapolates if the first/last sample is close to the boundary, and returns
// the result as either per-second (if isRate is true) or overall.
func extrapolatedRate(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper, isCounter bool, isRate bool) Vector {
	ms := args[0].(*parser.MatrixSelector)
	vs := ms.VectorSelector.(*parser.VectorSelector)

	var (
		samples    = vals[0].(Matrix)[0]
		rangeStart = enh.Ts - durationMilliseconds(ms.Range+vs.Offset)
		rangeEnd   = enh.Ts - durationMilliseconds(vs.Offset)
	)

	// No sense in trying to compute a rate without at least two points. Drop
	// this Vector element.
	if len(samples.Points) < 2 {
		return enh.Out
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

	return append(enh.Out, Sample{
		Point: Point{V: resultValue},
	})
}

// === delta(Matrix parser.ValueTypeMatrix) Vector ===
func funcDelta(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return extrapolatedRate(vals, args, enh, false, false)
}

// === rate(node parser.ValueTypeMatrix) Vector ===
func funcRate(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return extrapolatedRate(vals, args, enh, true, true)
}

// === increase(node parser.ValueTypeMatrix) Vector ===
func funcIncrease(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return extrapolatedRate(vals, args, enh, true, false)
}

// === irate(node parser.ValueTypeMatrix) Vector ===
func funcIrate(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return instantValue(vals, enh.Out, true)
}

// === idelta(node model.ValMatrix) Vector ===
func funcIdelta(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return instantValue(vals, enh.Out, false)
}

func instantValue(vals []parser.Value, out Vector, isRate bool) Vector {
	samples := vals[0].(Matrix)[0]
	// No sense in trying to compute a rate without at least two points. Drop
	// this Vector element.
	if len(samples.Points) < 2 {
		return out
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
		return out
	}

	if isRate {
		// Convert to per-second.
		resultValue /= float64(sampledInterval) / 1000
	}

	return append(out, Sample{
		Point: Point{V: resultValue},
	})
}

// Calculate the trend value at the given index i in raw data d.
// This is somewhat analogous to the slope of the trend at the given index.
// The argument "tf" is the trend factor.
// The argument "s0" is the computed smoothed value.
// The argument "s1" is the computed trend factor.
// The argument "b" is the raw input value.
func calcTrendValue(i int, tf, s0, s1, b float64) float64 {
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
func funcHoltWinters(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	samples := vals[0].(Matrix)[0]

	// The smoothing factor argument.
	sf := vals[1].(Vector)[0].V

	// The trend factor argument.
	tf := vals[2].(Vector)[0].V

	// Sanity check the input.
	if sf <= 0 || sf >= 1 {
		panic(errors.Errorf("invalid smoothing factor. Expected: 0 < sf < 1, got: %f", sf))
	}
	if tf <= 0 || tf >= 1 {
		panic(errors.Errorf("invalid trend factor. Expected: 0 < tf < 1, got: %f", tf))
	}

	l := len(samples.Points)

	// Can't do the smoothing operation with less than two points.
	if l < 2 {
		return enh.Out
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
		b = calcTrendValue(i-1, tf, s0, s1, b)
		y = (1 - sf) * (s1 + b)

		s0, s1 = s1, x+y
	}

	return append(enh.Out, Sample{
		Point: Point{V: s1},
	})
}

// === sort(node parser.ValueTypeVector) Vector ===
func funcSort(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	// NaN should sort to the bottom, so take descending sort with NaN first and
	// reverse it.
	byValueSorter := vectorByReverseValueHeap(vals[0].(Vector))
	sort.Sort(sort.Reverse(byValueSorter))
	return Vector(byValueSorter)
}

// === sortDesc(node parser.ValueTypeVector) Vector ===
func funcSortDesc(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	// NaN should sort to the bottom, so take ascending sort with NaN first and
	// reverse it.
	byValueSorter := vectorByValueHeap(vals[0].(Vector))
	sort.Sort(sort.Reverse(byValueSorter))
	return Vector(byValueSorter)
}

// === clamp_max(Vector parser.ValueTypeVector, max Scalar) Vector ===
func funcClampMax(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	vec := vals[0].(Vector)
	max := vals[1].(Vector)[0].Point.V
	for _, el := range vec {
		enh.Out = append(enh.Out, Sample{
			Metric: enh.DropMetricName(el.Metric),
			Point:  Point{V: math.Min(max, el.V)},
		})
	}
	return enh.Out
}

// === clamp_min(Vector parser.ValueTypeVector, min Scalar) Vector ===
func funcClampMin(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	vec := vals[0].(Vector)
	min := vals[1].(Vector)[0].Point.V
	for _, el := range vec {
		enh.Out = append(enh.Out, Sample{
			Metric: enh.DropMetricName(el.Metric),
			Point:  Point{V: math.Max(min, el.V)},
		})
	}
	return enh.Out
}

// === round(Vector parser.ValueTypeVector, toNearest=1 Scalar) Vector ===
func funcRound(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
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
		enh.Out = append(enh.Out, Sample{
			Metric: enh.DropMetricName(el.Metric),
			Point:  Point{V: v},
		})
	}
	return enh.Out
}

// === Scalar(node parser.ValueTypeVector) Scalar ===
func funcScalar(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	v := vals[0].(Vector)
	if len(v) != 1 {
		return append(enh.Out, Sample{
			Point: Point{V: math.NaN()},
		})
	}
	return append(enh.Out, Sample{
		Point: Point{V: v[0].V},
	})
}

func aggrOverTime(vals []parser.Value, enh *EvalNodeHelper, aggrFn func([]Point) float64) Vector {
	el := vals[0].(Matrix)[0]

	return append(enh.Out, Sample{
		Point: Point{V: aggrFn(el.Points)},
	})
}

// === avg_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcAvgOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		var mean, count float64
		for _, v := range values {
			count++
			if math.IsInf(mean, 0) {
				if math.IsInf(v.V, 0) && (mean > 0) == (v.V > 0) {
					// The `mean` and `v.V` values are `Inf` of the same sign.  They
					// can't be subtracted, but the value of `mean` is correct
					// already.
					continue
				}
				if !math.IsInf(v.V, 0) && !math.IsNaN(v.V) {
					// At this stage, the mean is an infinite. If the added
					// value is neither an Inf or a Nan, we can keep that mean
					// value.
					// This is required because our calculation below removes
					// the mean value, which would look like Inf += x - Inf and
					// end up as a NaN.
					continue
				}
			}
			mean += v.V/count - mean/count
		}
		return mean
	})
}

// === count_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcCountOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		return float64(len(values))
	})
}

// === floor(Vector parser.ValueTypeVector) Vector ===
// === max_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcMaxOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
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

// === min_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcMinOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
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

// === sum_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcSumOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return aggrOverTime(vals, enh, func(values []Point) float64 {
		var sum float64
		for _, v := range values {
			sum += v.V
		}
		return sum
	})
}

// === quantile_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcQuantileOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	q := vals[0].(Vector)[0].V
	el := vals[1].(Matrix)[0]

	values := make(vectorByValueHeap, 0, len(el.Points))
	for _, v := range el.Points {
		values = append(values, Sample{Point: Point{V: v.V}})
	}
	return append(enh.Out, Sample{
		Point: Point{V: quantile(q, values)},
	})
}

// === stddev_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcStddevOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
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

// === stdvar_over_time(Matrix parser.ValueTypeMatrix) Vector ===
func funcStdvarOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
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

// === absent(Vector parser.ValueTypeVector) Vector ===
func funcAbsent(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	if len(vals[0].(Vector)) > 0 {
		return enh.Out
	}
	return append(enh.Out,
		Sample{
			Metric: createLabelsForAbsentFunction(args[0]),
			Point:  Point{V: 1},
		})
}

// === absent_over_time(Vector parser.ValueTypeMatrix) Vector ===
// As this function has a matrix as argument, it does not get all the Series.
// This function will return 1 if the matrix has at least one element.
// Due to engine optimization, this function is only called when this condition is true.
// Then, the engine post-processes the results to get the expected output.
func funcAbsentOverTime(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return append(enh.Out,
		Sample{
			Point: Point{V: 1},
		})
}

func simpleFunc(vals []parser.Value, enh *EvalNodeHelper, f func(float64) float64) Vector {
	for _, el := range vals[0].(Vector) {
		enh.Out = append(enh.Out, Sample{
			Metric: enh.DropMetricName(el.Metric),
			Point:  Point{V: f(el.V)},
		})
	}
	return enh.Out
}

// === abs(Vector parser.ValueTypeVector) Vector ===
func funcAbs(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Abs)
}

// === ceil(Vector parser.ValueTypeVector) Vector ===
func funcCeil(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Ceil)
}

// === floor(Vector parser.ValueTypeVector) Vector ===
func funcFloor(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Floor)
}

// === exp(Vector parser.ValueTypeVector) Vector ===
func funcExp(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Exp)
}

// === sqrt(Vector VectorNode) Vector ===
func funcSqrt(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Sqrt)
}

// === ln(Vector parser.ValueTypeVector) Vector ===
func funcLn(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Log)
}

// === log2(Vector parser.ValueTypeVector) Vector ===
func funcLog2(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Log2)
}

// === log10(Vector parser.ValueTypeVector) Vector ===
func funcLog10(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return simpleFunc(vals, enh, math.Log10)
}

// === timestamp(Vector parser.ValueTypeVector) Vector ===
func funcTimestamp(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	vec := vals[0].(Vector)
	for _, el := range vec {
		enh.Out = append(enh.Out, Sample{
			Metric: enh.DropMetricName(el.Metric),
			Point:  Point{V: float64(el.T) / 1000},
		})
	}
	return enh.Out
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

// === deriv(node parser.ValueTypeMatrix) Vector ===
func funcDeriv(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	samples := vals[0].(Matrix)[0]

	// No sense in trying to compute a derivative without at least two points.
	// Drop this Vector element.
	if len(samples.Points) < 2 {
		return enh.Out
	}

	// We pass in an arbitrary timestamp that is near the values in use
	// to avoid floating point accuracy issues, see
	// https://github.com/prometheus/prometheus/issues/2674
	slope, _ := linearRegression(samples.Points, samples.Points[0].T)
	return append(enh.Out, Sample{
		Point: Point{V: slope},
	})
}

// === predict_linear(node parser.ValueTypeMatrix, k parser.ValueTypeScalar) Vector ===
func funcPredictLinear(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	samples := vals[0].(Matrix)[0]
	duration := vals[1].(Vector)[0].V

	// No sense in trying to predict anything without at least two points.
	// Drop this Vector element.
	if len(samples.Points) < 2 {
		return enh.Out
	}
	slope, intercept := linearRegression(samples.Points, enh.Ts)

	return append(enh.Out, Sample{
		Point: Point{V: slope*duration + intercept},
	})
}

// === histogram_quantile(k parser.ValueTypeScalar, Vector parser.ValueTypeVector) Vector ===
func funcHistogramQuantile(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	q := vals[0].(Vector)[0].V
	inVec := vals[1].(Vector)
	sigf := signatureFunc(false, enh.lblBuf, excludedLabels...)

	if enh.signatureToMetricWithBuckets == nil {
		enh.signatureToMetricWithBuckets = map[string]*metricWithBuckets{}
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
		l := sigf(el.Metric)

		mb, ok := enh.signatureToMetricWithBuckets[l]
		if !ok {
			el.Metric = labels.NewBuilder(el.Metric).
				Del(labels.BucketLabel, labels.MetricName).
				Labels()

			mb = &metricWithBuckets{el.Metric, nil}
			enh.signatureToMetricWithBuckets[l] = mb
		}
		mb.buckets = append(mb.buckets, bucket{upperBound, el.V})
	}

	for _, mb := range enh.signatureToMetricWithBuckets {
		if len(mb.buckets) > 0 {
			enh.Out = append(enh.Out, Sample{
				Metric: mb.metric,
				Point:  Point{V: bucketQuantile(q, mb.buckets)},
			})
		}
	}

	return enh.Out
}

// === resets(Matrix parser.ValueTypeMatrix) Vector ===
func funcResets(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	samples := vals[0].(Matrix)[0]

	resets := 0
	prev := samples.Points[0].V
	for _, sample := range samples.Points[1:] {
		current := sample.V
		if current < prev {
			resets++
		}
		prev = current
	}

	return append(enh.Out, Sample{
		Point: Point{V: float64(resets)},
	})
}

// === changes(Matrix parser.ValueTypeMatrix) Vector ===
func funcChanges(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	samples := vals[0].(Matrix)[0]

	changes := 0
	prev := samples.Points[0].V
	for _, sample := range samples.Points[1:] {
		current := sample.V
		if current != prev && !(math.IsNaN(current) && math.IsNaN(prev)) {
			changes++
		}
		prev = current
	}

	return append(enh.Out, Sample{
		Point: Point{V: float64(changes)},
	})
}

// === label_replace(Vector parser.ValueTypeVector, dst_label, replacement, src_labelname, regex parser.ValueTypeString) Vector ===
func funcLabelReplace(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	var (
		vector   = vals[0].(Vector)
		dst      = args[1].(*parser.StringLiteral).Val
		repl     = args[2].(*parser.StringLiteral).Val
		src      = args[3].(*parser.StringLiteral).Val
		regexStr = args[4].(*parser.StringLiteral).Val
	)

	if enh.regex == nil {
		var err error
		enh.regex, err = regexp.Compile("^(?:" + regexStr + ")$")
		if err != nil {
			panic(errors.Errorf("invalid regular expression in label_replace(): %s", regexStr))
		}
		if !model.LabelNameRE.MatchString(dst) {
			panic(errors.Errorf("invalid destination label name in label_replace(): %s", dst))
		}
		enh.Dmn = make(map[uint64]labels.Labels, len(enh.Out))
	}

	for _, el := range vector {
		h := el.Metric.Hash()
		var outMetric labels.Labels
		if l, ok := enh.Dmn[h]; ok {
			outMetric = l
		} else {
			srcVal := el.Metric.Get(src)
			indexes := enh.regex.FindStringSubmatchIndex(srcVal)
			if indexes == nil {
				// If there is no match, no replacement should take place.
				outMetric = el.Metric
				enh.Dmn[h] = outMetric
			} else {
				res := enh.regex.ExpandString([]byte{}, repl, srcVal, indexes)

				lb := labels.NewBuilder(el.Metric).Del(dst)
				if len(res) > 0 {
					lb.Set(dst, string(res))
				}
				outMetric = lb.Labels()
				enh.Dmn[h] = outMetric
			}
		}

		enh.Out = append(enh.Out, Sample{
			Metric: outMetric,
			Point:  Point{V: el.Point.V},
		})
	}
	return enh.Out
}

// === Vector(s Scalar) Vector ===
func funcVector(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return append(enh.Out,
		Sample{
			Metric: labels.Labels{},
			Point:  Point{V: vals[0].(Vector)[0].V},
		})
}

// === label_join(vector model.ValVector, dest_labelname, separator, src_labelname...) Vector ===
func funcLabelJoin(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	var (
		vector    = vals[0].(Vector)
		dst       = args[1].(*parser.StringLiteral).Val
		sep       = args[2].(*parser.StringLiteral).Val
		srcLabels = make([]string, len(args)-3)
	)

	if enh.Dmn == nil {
		enh.Dmn = make(map[uint64]labels.Labels, len(enh.Out))
	}

	for i := 3; i < len(args); i++ {
		src := args[i].(*parser.StringLiteral).Val
		if !model.LabelName(src).IsValid() {
			panic(errors.Errorf("invalid source label name in label_join(): %s", src))
		}
		srcLabels[i-3] = src
	}

	if !model.LabelName(dst).IsValid() {
		panic(errors.Errorf("invalid destination label name in label_join(): %s", dst))
	}

	srcVals := make([]string, len(srcLabels))
	for _, el := range vector {
		h := el.Metric.Hash()
		var outMetric labels.Labels
		if l, ok := enh.Dmn[h]; ok {
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
			enh.Dmn[h] = outMetric
		}

		enh.Out = append(enh.Out, Sample{
			Metric: outMetric,
			Point:  Point{V: el.Point.V},
		})
	}
	return enh.Out
}

// Common code for date related functions.
func dateWrapper(vals []parser.Value, enh *EvalNodeHelper, f func(time.Time) float64) Vector {
	if len(vals) == 0 {
		return append(enh.Out,
			Sample{
				Metric: labels.Labels{},
				Point:  Point{V: f(time.Unix(enh.Ts/1000, 0).UTC())},
			})
	}

	for _, el := range vals[0].(Vector) {
		t := time.Unix(int64(el.V), 0).UTC()
		enh.Out = append(enh.Out, Sample{
			Metric: enh.DropMetricName(el.Metric),
			Point:  Point{V: f(t)},
		})
	}
	return enh.Out
}

// === days_in_month(v Vector) Scalar ===
func funcDaysInMonth(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(32 - time.Date(t.Year(), t.Month(), 32, 0, 0, 0, 0, time.UTC).Day())
	})
}

// === day_of_month(v Vector) Scalar ===
func funcDayOfMonth(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Day())
	})
}

// === day_of_week(v Vector) Scalar ===
func funcDayOfWeek(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Weekday())
	})
}

// === hour(v Vector) Scalar ===
func funcHour(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Hour())
	})
}

// === minute(v Vector) Scalar ===
func funcMinute(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Minute())
	})
}

// === month(v Vector) Scalar ===
func funcMonth(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Month())
	})
}

// === year(v Vector) Scalar ===
func funcYear(vals []parser.Value, args parser.Expressions, enh *EvalNodeHelper) Vector {
	return dateWrapper(vals, enh, func(t time.Time) float64 {
		return float64(t.Year())
	})
}

// FunctionCalls is a list of all functions supported by PromQL, including their types.
var FunctionCalls = map[string]FunctionCall{
	"abs":                funcAbs,
	"absent":             funcAbsent,
	"absent_over_time":   funcAbsentOverTime,
	"avg_over_time":      funcAvgOverTime,
	"ceil":               funcCeil,
	"changes":            funcChanges,
	"clamp_max":          funcClampMax,
	"clamp_min":          funcClampMin,
	"count_over_time":    funcCountOverTime,
	"days_in_month":      funcDaysInMonth,
	"day_of_month":       funcDayOfMonth,
	"day_of_week":        funcDayOfWeek,
	"delta":              funcDelta,
	"deriv":              funcDeriv,
	"exp":                funcExp,
	"floor":              funcFloor,
	"histogram_quantile": funcHistogramQuantile,
	"holt_winters":       funcHoltWinters,
	"hour":               funcHour,
	"idelta":             funcIdelta,
	"increase":           funcIncrease,
	"irate":              funcIrate,
	"label_replace":      funcLabelReplace,
	"label_join":         funcLabelJoin,
	"ln":                 funcLn,
	"log10":              funcLog10,
	"log2":               funcLog2,
	"max_over_time":      funcMaxOverTime,
	"min_over_time":      funcMinOverTime,
	"minute":             funcMinute,
	"month":              funcMonth,
	"predict_linear":     funcPredictLinear,
	"quantile_over_time": funcQuantileOverTime,
	"rate":               funcRate,
	"resets":             funcResets,
	"round":              funcRound,
	"scalar":             funcScalar,
	"sort":               funcSort,
	"sort_desc":          funcSortDesc,
	"sqrt":               funcSqrt,
	"stddev_over_time":   funcStddevOverTime,
	"stdvar_over_time":   funcStdvarOverTime,
	"sum_over_time":      funcSumOverTime,
	"time":               funcTime,
	"timestamp":          funcTimestamp,
	"vector":             funcVector,
	"year":               funcYear,
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

// createLabelsForAbsentFunction returns the labels that are uniquely and exactly matched
// in a given expression. It is used in the absent functions.
func createLabelsForAbsentFunction(expr parser.Expr) labels.Labels {
	m := labels.Labels{}

	var lm []*labels.Matcher
	switch n := expr.(type) {
	case *parser.VectorSelector:
		lm = n.LabelMatchers
	case *parser.MatrixSelector:
		lm = n.VectorSelector.(*parser.VectorSelector).LabelMatchers
	default:
		return m
	}

	empty := []string{}
	for _, ma := range lm {
		if ma.Name == labels.MetricName {
			continue
		}
		if ma.Type == labels.MatchEqual && !m.Has(ma.Name) {
			m = labels.NewBuilder(m).Set(ma.Name, ma.Value).Labels()
		} else {
			empty = append(empty, ma.Name)
		}
	}

	for _, v := range empty {
		m = labels.NewBuilder(m).Del(v).Labels()
	}
	return m
}
