// Copyright 2023 The Prometheus Authors
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

package annotations

import (
	"errors"
	"fmt"

	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/promql/parser/posrange"
)

// Annotations is a general wrapper for warnings and other information
// that is returned by the query API along with the results.
// Each individual annotation is modeled by a Go error.
// They are deduplicated based on the string returned by error.Error().
// The zero value is usable without further initialization, see New().
type Annotations map[string]error

// New returns new Annotations ready to use. Note that the zero value of
// Annotations is also fully usable, but using this method is often more
// readable.
func New() *Annotations {
	return &Annotations{}
}

// Add adds an annotation (modeled as a Go error) in-place and returns the
// modified Annotations for convenience.
func (a *Annotations) Add(err error) Annotations {
	if *a == nil {
		*a = Annotations{}
	}
	(*a)[err.Error()] = err
	return *a
}

// Merge adds the contents of the second annotation to the first, modifying
// the first in-place, and returns the merged first Annotation for convenience.
func (a *Annotations) Merge(aa Annotations) Annotations {
	if *a == nil {
		if aa == nil {
			return nil
		}
		*a = Annotations{}
	}
	for key, val := range aa {
		(*a)[key] = val
	}
	return *a
}

// AsErrors is a convenience function to return the annotations map as a slice
// of errors.
func (a Annotations) AsErrors() []error {
	arr := make([]error, 0, len(a))
	for _, err := range a {
		arr = append(arr, err)
	}
	return arr
}

// AsStrings is a convenience function to return the annotations map as 2 slices
// of strings, separated into warnings and infos. The query string is used to get the
// line number and character offset positioning info of the elements which trigger an
// annotation. We limit the number of warnings and infos returned here with maxWarnings
// and maxInfos respectively (0 for no limit).
func (a Annotations) AsStrings(query string, maxWarnings, maxInfos int) (warnings, infos []string) {
	warnings = make([]string, 0, maxWarnings+1)
	infos = make([]string, 0, maxInfos+1)
	warnSkipped := 0
	infoSkipped := 0
	for _, err := range a {
		var anErr annoErr
		if errors.As(err, &anErr) {
			anErr.Query = query
			err = anErr
		}
		switch {
		case errors.Is(err, PromQLInfo):
			if maxInfos == 0 || len(infos) < maxInfos {
				infos = append(infos, err.Error())
			} else {
				infoSkipped++
			}
		default:
			if maxWarnings == 0 || len(warnings) < maxWarnings {
				warnings = append(warnings, err.Error())
			} else {
				warnSkipped++
			}
		}
	}
	if warnSkipped > 0 {
		warnings = append(warnings, fmt.Sprintf("%d more warning annotations omitted", warnSkipped))
	}
	if infoSkipped > 0 {
		infos = append(infos, fmt.Sprintf("%d more info annotations omitted", infoSkipped))
	}
	return
}

// CountWarningsAndInfo counts and returns the number of warnings and infos in the
// annotations wrapper.
func (a Annotations) CountWarningsAndInfo() (countWarnings, countInfo int) {
	for _, err := range a {
		if errors.Is(err, PromQLWarning) {
			countWarnings++
		}
		if errors.Is(err, PromQLInfo) {
			countInfo++
		}
	}
	return
}

//nolint:revive // error-naming.
var (
	// Currently there are only 2 types, warnings and info.
	// For now, info are visually identical with warnings as we have not updated
	// the API spec or the frontend to show a different kind of warning. But we
	// make the distinction here to prepare for adding them in future.
	PromQLInfo    = errors.New("PromQL info")
	PromQLWarning = errors.New("PromQL warning")

	InvalidRatioWarning                        = fmt.Errorf("%w: ratio value should be between -1 and 1", PromQLWarning)
	InvalidQuantileWarning                     = fmt.Errorf("%w: quantile value should be between 0 and 1", PromQLWarning)
	BadBucketLabelWarning                      = fmt.Errorf("%w: bucket label %q is missing or has a malformed value", PromQLWarning, model.BucketLabel)
	MixedFloatsHistogramsWarning               = fmt.Errorf("%w: encountered a mix of histograms and floats for", PromQLWarning)
	MixedClassicNativeHistogramsWarning        = fmt.Errorf("%w: vector contains a mix of classic and native histograms for metric name", PromQLWarning)
	NativeHistogramNotCounterWarning           = fmt.Errorf("%w: this native histogram metric is not a counter:", PromQLWarning)
	NativeHistogramNotGaugeWarning             = fmt.Errorf("%w: this native histogram metric is not a gauge:", PromQLWarning)
	MixedExponentialCustomHistogramsWarning    = fmt.Errorf("%w: vector contains a mix of histograms with exponential and custom buckets schemas for metric name", PromQLWarning)
	IncompatibleCustomBucketsHistogramsWarning = fmt.Errorf("%w: vector contains histograms with incompatible custom buckets for metric name", PromQLWarning)
	IncompatibleBucketLayoutInBinOpWarning     = fmt.Errorf("%w: incompatible bucket layout encountered for binary operator", PromQLWarning)

	PossibleNonCounterInfo                  = fmt.Errorf("%w: metric might not be a counter, name does not end in _total/_sum/_count/_bucket:", PromQLInfo)
	HistogramQuantileForcedMonotonicityInfo = fmt.Errorf("%w: input to histogram_quantile needed to be fixed for monotonicity (see https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile) for metric name", PromQLInfo)
	IncompatibleTypesInBinOpInfo            = fmt.Errorf("%w: incompatible sample types encountered for binary operator", PromQLInfo)
	HistogramIgnoredInAggregationInfo       = fmt.Errorf("%w: ignored histogram in", PromQLInfo)
	HistogramIgnoredInMixedRangeInfo        = fmt.Errorf("%w: ignored histograms in a range containing both floats and histograms for metric name", PromQLInfo)
)

type annoErr struct {
	PositionRange posrange.PositionRange
	Err           error
	Query         string
}

func (e annoErr) Error() string {
	if e.Query == "" {
		return e.Err.Error()
	}
	return fmt.Sprintf("%s (%s)", e.Err, e.PositionRange.StartPosInput(e.Query, 0))
}

func (e annoErr) Unwrap() error {
	return e.Err
}

// NewInvalidQuantileWarning is used when the user specifies an invalid quantile
// value, i.e. a float that is outside the range [0, 1] or NaN.
func NewInvalidQuantileWarning(q float64, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w, got %g", InvalidQuantileWarning, q),
	}
}

// NewInvalidRatioWarning is used when the user specifies an invalid ratio
// value, i.e. a float that is outside the range [-1, 1] or NaN.
func NewInvalidRatioWarning(q, to float64, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w, got %g, capping to %g", InvalidRatioWarning, q, to),
	}
}

// NewBadBucketLabelWarning is used when there is an error parsing the bucket label
// of a classic histogram.
func NewBadBucketLabelWarning(metricName, label string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w of %q for metric name %q", BadBucketLabelWarning, label, metricName),
	}
}

// NewMixedFloatsHistogramsWarning is used when the queried series includes both
// float samples and histogram samples for functions that do not support mixed
// samples.
func NewMixedFloatsHistogramsWarning(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w metric name %q", MixedFloatsHistogramsWarning, metricName),
	}
}

// NewMixedFloatsHistogramsAggWarning is used when the queried series includes both
// float samples and histogram samples in an aggregation.
func NewMixedFloatsHistogramsAggWarning(pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w aggregation", MixedFloatsHistogramsWarning),
	}
}

// NewMixedClassicNativeHistogramsWarning is used when the queried series includes
// both classic and native histograms.
func NewMixedClassicNativeHistogramsWarning(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", MixedClassicNativeHistogramsWarning, metricName),
	}
}

// NewNativeHistogramNotCounterWarning is used when histogramRate is called
// with isCounter set to true on a gauge histogram.
func NewNativeHistogramNotCounterWarning(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", NativeHistogramNotCounterWarning, metricName),
	}
}

// NewNativeHistogramNotGaugeWarning is used when histogramRate is called
// with isCounter set to false on a counter histogram.
func NewNativeHistogramNotGaugeWarning(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", NativeHistogramNotGaugeWarning, metricName),
	}
}

// NewMixedExponentialCustomHistogramsWarning is used when the queried series includes
// histograms with both exponential and custom buckets schemas.
func NewMixedExponentialCustomHistogramsWarning(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", MixedExponentialCustomHistogramsWarning, metricName),
	}
}

// NewIncompatibleCustomBucketsHistogramsWarning is used when the queried series includes
// custom buckets histograms with incompatible custom bounds.
func NewIncompatibleCustomBucketsHistogramsWarning(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", IncompatibleCustomBucketsHistogramsWarning, metricName),
	}
}

// NewPossibleNonCounterInfo is used when a named counter metric with only float samples does not
// have the suffixes _total, _sum, _count, or _bucket.
func NewPossibleNonCounterInfo(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", PossibleNonCounterInfo, metricName),
	}
}

// NewHistogramQuantileForcedMonotonicityInfo is used when the input (classic histograms) to
// histogram_quantile needs to be forced to be monotonic.
func NewHistogramQuantileForcedMonotonicityInfo(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", HistogramQuantileForcedMonotonicityInfo, metricName),
	}
}

// NewIncompatibleTypesInBinOpInfo is used if binary operators act on a
// combination of types that doesn't work and therefore returns no result.
func NewIncompatibleTypesInBinOpInfo(lhsType, operator, rhsType string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q: %s %s %s", IncompatibleTypesInBinOpInfo, operator, lhsType, operator, rhsType),
	}
}

// NewHistogramIgnoredInAggregationInfo is used when a histogram is ignored by
// an aggregation operator that cannot handle histograms.
func NewHistogramIgnoredInAggregationInfo(aggregation string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %s aggregation", HistogramIgnoredInAggregationInfo, aggregation),
	}
}

// NewHistogramIgnoredInMixedRangeInfo is used when a histogram is ignored
// in a range vector which contains mix of floats and histograms.
func NewHistogramIgnoredInMixedRangeInfo(metricName string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %q", HistogramIgnoredInMixedRangeInfo, metricName),
	}
}

// NewIncompatibleBucketLayoutInBinOpWarning is used if binary operators act on a
// combination of two incompatible histograms.
func NewIncompatibleBucketLayoutInBinOpWarning(operator string, pos posrange.PositionRange) error {
	return annoErr{
		PositionRange: pos,
		Err:           fmt.Errorf("%w %s", IncompatibleBucketLayoutInBinOpWarning, operator),
	}
}
