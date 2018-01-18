// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// MovAvgAggregation operates on a series of data. It will slide a window
// across the data and emit the average value of that window.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html
type MovAvgAggregation struct {
	format    string
	gapPolicy string
	model     MovAvgModel
	window    *int
	predict   *int
	minimize  *bool

	subAggregations map[string]Aggregation
	meta            map[string]interface{}
	bucketsPaths    []string
}

// NewMovAvgAggregation creates and initializes a new MovAvgAggregation.
func NewMovAvgAggregation() *MovAvgAggregation {
	return &MovAvgAggregation{
		subAggregations: make(map[string]Aggregation),
		bucketsPaths:    make([]string, 0),
	}
}

func (a *MovAvgAggregation) Format(format string) *MovAvgAggregation {
	a.format = format
	return a
}

// GapPolicy defines what should be done when a gap in the series is discovered.
// Valid values include "insert_zeros" or "skip". Default is "insert_zeros".
func (a *MovAvgAggregation) GapPolicy(gapPolicy string) *MovAvgAggregation {
	a.gapPolicy = gapPolicy
	return a
}

// GapInsertZeros inserts zeros for gaps in the series.
func (a *MovAvgAggregation) GapInsertZeros() *MovAvgAggregation {
	a.gapPolicy = "insert_zeros"
	return a
}

// GapSkip skips gaps in the series.
func (a *MovAvgAggregation) GapSkip() *MovAvgAggregation {
	a.gapPolicy = "skip"
	return a
}

// Model is used to define what type of moving average you want to use
// in the series.
func (a *MovAvgAggregation) Model(model MovAvgModel) *MovAvgAggregation {
	a.model = model
	return a
}

// Window sets the window size for the moving average. This window will
// "slide" across the series, and the values inside that window will
// be used to calculate the moving avg value.
func (a *MovAvgAggregation) Window(window int) *MovAvgAggregation {
	a.window = &window
	return a
}

// Predict sets the number of predictions that should be returned.
// Each prediction will be spaced at the intervals in the histogram.
// E.g. a predict of 2 will return two new buckets at the end of the
// histogram with the predicted values.
func (a *MovAvgAggregation) Predict(numPredictions int) *MovAvgAggregation {
	a.predict = &numPredictions
	return a
}

// Minimize determines if the model should be fit to the data using a
// cost minimizing algorithm.
func (a *MovAvgAggregation) Minimize(minimize bool) *MovAvgAggregation {
	a.minimize = &minimize
	return a
}

// SubAggregation adds a sub-aggregation to this aggregation.
func (a *MovAvgAggregation) SubAggregation(name string, subAggregation Aggregation) *MovAvgAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *MovAvgAggregation) Meta(metaData map[string]interface{}) *MovAvgAggregation {
	a.meta = metaData
	return a
}

// BucketsPath sets the paths to the buckets to use for this pipeline aggregator.
func (a *MovAvgAggregation) BucketsPath(bucketsPaths ...string) *MovAvgAggregation {
	a.bucketsPaths = append(a.bucketsPaths, bucketsPaths...)
	return a
}

func (a *MovAvgAggregation) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["moving_avg"] = params

	if a.format != "" {
		params["format"] = a.format
	}
	if a.gapPolicy != "" {
		params["gap_policy"] = a.gapPolicy
	}
	if a.model != nil {
		params["model"] = a.model.Name()
		settings := a.model.Settings()
		if len(settings) > 0 {
			params["settings"] = settings
		}
	}
	if a.window != nil {
		params["window"] = *a.window
	}
	if a.predict != nil {
		params["predict"] = *a.predict
	}
	if a.minimize != nil {
		params["minimize"] = *a.minimize
	}

	// Add buckets paths
	switch len(a.bucketsPaths) {
	case 0:
	case 1:
		params["buckets_path"] = a.bucketsPaths[0]
	default:
		params["buckets_path"] = a.bucketsPaths
	}

	// AggregationBuilder (SubAggregations)
	if len(a.subAggregations) > 0 {
		aggsMap := make(map[string]interface{})
		source["aggregations"] = aggsMap
		for name, aggregate := range a.subAggregations {
			src, err := aggregate.Source()
			if err != nil {
				return nil, err
			}
			aggsMap[name] = src
		}
	}

	// Add Meta data if available
	if len(a.meta) > 0 {
		source["meta"] = a.meta
	}

	return source, nil
}

// -- Models for moving averages --
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html#_models

// MovAvgModel specifies the model to use with the MovAvgAggregation.
type MovAvgModel interface {
	Name() string
	Settings() map[string]interface{}
}

// -- EWMA --

// EWMAMovAvgModel calculates an exponentially weighted moving average.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html#_ewma_exponentially_weighted
type EWMAMovAvgModel struct {
	alpha *float64
}

// NewEWMAMovAvgModel creates and initializes a new EWMAMovAvgModel.
func NewEWMAMovAvgModel() *EWMAMovAvgModel {
	return &EWMAMovAvgModel{}
}

// Alpha controls the smoothing of the data. Alpha = 1 retains no memory
// of past values (e.g. a random walk), while alpha = 0 retains infinite
// memory of past values (e.g. the series mean). Useful values are somewhere
// in between. Defaults to 0.5.
func (m *EWMAMovAvgModel) Alpha(alpha float64) *EWMAMovAvgModel {
	m.alpha = &alpha
	return m
}

// Name of the model.
func (m *EWMAMovAvgModel) Name() string {
	return "ewma"
}

// Settings of the model.
func (m *EWMAMovAvgModel) Settings() map[string]interface{} {
	settings := make(map[string]interface{})
	if m.alpha != nil {
		settings["alpha"] = *m.alpha
	}
	return settings
}

// -- Holt linear --

// HoltLinearMovAvgModel calculates a doubly exponential weighted moving average.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html#_holt_linear
type HoltLinearMovAvgModel struct {
	alpha *float64
	beta  *float64
}

// NewHoltLinearMovAvgModel creates and initializes a new HoltLinearMovAvgModel.
func NewHoltLinearMovAvgModel() *HoltLinearMovAvgModel {
	return &HoltLinearMovAvgModel{}
}

// Alpha controls the smoothing of the data. Alpha = 1 retains no memory
// of past values (e.g. a random walk), while alpha = 0 retains infinite
// memory of past values (e.g. the series mean). Useful values are somewhere
// in between. Defaults to 0.5.
func (m *HoltLinearMovAvgModel) Alpha(alpha float64) *HoltLinearMovAvgModel {
	m.alpha = &alpha
	return m
}

// Beta is equivalent to Alpha but controls the smoothing of the trend
// instead of the data.
func (m *HoltLinearMovAvgModel) Beta(beta float64) *HoltLinearMovAvgModel {
	m.beta = &beta
	return m
}

// Name of the model.
func (m *HoltLinearMovAvgModel) Name() string {
	return "holt"
}

// Settings of the model.
func (m *HoltLinearMovAvgModel) Settings() map[string]interface{} {
	settings := make(map[string]interface{})
	if m.alpha != nil {
		settings["alpha"] = *m.alpha
	}
	if m.beta != nil {
		settings["beta"] = *m.beta
	}
	return settings
}

// -- Holt Winters --

// HoltWintersMovAvgModel calculates a triple exponential weighted moving average.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html#_holt_winters
type HoltWintersMovAvgModel struct {
	alpha           *float64
	beta            *float64
	gamma           *float64
	period          *int
	seasonalityType string
	pad             *bool
}

// NewHoltWintersMovAvgModel creates and initializes a new HoltWintersMovAvgModel.
func NewHoltWintersMovAvgModel() *HoltWintersMovAvgModel {
	return &HoltWintersMovAvgModel{}
}

// Alpha controls the smoothing of the data. Alpha = 1 retains no memory
// of past values (e.g. a random walk), while alpha = 0 retains infinite
// memory of past values (e.g. the series mean). Useful values are somewhere
// in between. Defaults to 0.5.
func (m *HoltWintersMovAvgModel) Alpha(alpha float64) *HoltWintersMovAvgModel {
	m.alpha = &alpha
	return m
}

// Beta is equivalent to Alpha but controls the smoothing of the trend
// instead of the data.
func (m *HoltWintersMovAvgModel) Beta(beta float64) *HoltWintersMovAvgModel {
	m.beta = &beta
	return m
}

func (m *HoltWintersMovAvgModel) Gamma(gamma float64) *HoltWintersMovAvgModel {
	m.gamma = &gamma
	return m
}

func (m *HoltWintersMovAvgModel) Period(period int) *HoltWintersMovAvgModel {
	m.period = &period
	return m
}

func (m *HoltWintersMovAvgModel) SeasonalityType(typ string) *HoltWintersMovAvgModel {
	m.seasonalityType = typ
	return m
}

func (m *HoltWintersMovAvgModel) Pad(pad bool) *HoltWintersMovAvgModel {
	m.pad = &pad
	return m
}

// Name of the model.
func (m *HoltWintersMovAvgModel) Name() string {
	return "holt_winters"
}

// Settings of the model.
func (m *HoltWintersMovAvgModel) Settings() map[string]interface{} {
	settings := make(map[string]interface{})
	if m.alpha != nil {
		settings["alpha"] = *m.alpha
	}
	if m.beta != nil {
		settings["beta"] = *m.beta
	}
	if m.gamma != nil {
		settings["gamma"] = *m.gamma
	}
	if m.period != nil {
		settings["period"] = *m.period
	}
	if m.pad != nil {
		settings["pad"] = *m.pad
	}
	if m.seasonalityType != "" {
		settings["type"] = m.seasonalityType
	}
	return settings
}

// -- Linear --

// LinearMovAvgModel calculates a linearly weighted moving average, such
// that older values are linearly less important. "Time" is determined
// by position in collection.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html#_linear
type LinearMovAvgModel struct {
}

// NewLinearMovAvgModel creates and initializes a new LinearMovAvgModel.
func NewLinearMovAvgModel() *LinearMovAvgModel {
	return &LinearMovAvgModel{}
}

// Name of the model.
func (m *LinearMovAvgModel) Name() string {
	return "linear"
}

// Settings of the model.
func (m *LinearMovAvgModel) Settings() map[string]interface{} {
	return nil
}

// -- Simple --

// SimpleMovAvgModel calculates a simple unweighted (arithmetic) moving average.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html#_simple
type SimpleMovAvgModel struct {
}

// NewSimpleMovAvgModel creates and initializes a new SimpleMovAvgModel.
func NewSimpleMovAvgModel() *SimpleMovAvgModel {
	return &SimpleMovAvgModel{}
}

// Name of the model.
func (m *SimpleMovAvgModel) Name() string {
	return "simple"
}

// Settings of the model.
func (m *SimpleMovAvgModel) Settings() map[string]interface{} {
	return nil
}
