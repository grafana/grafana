// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// SignificantSignificantTermsAggregation is an aggregation that returns interesting
// or unusual occurrences of terms in a set.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html
type SignificantTermsAggregation struct {
	field           string
	subAggregations map[string]Aggregation
	meta            map[string]interface{}

	minDocCount           *int
	shardMinDocCount      *int
	requiredSize          *int
	shardSize             *int
	filter                Query
	executionHint         string
	significanceHeuristic SignificanceHeuristic
}

func NewSignificantTermsAggregation() *SignificantTermsAggregation {
	return &SignificantTermsAggregation{
		subAggregations: make(map[string]Aggregation, 0),
	}
}

func (a *SignificantTermsAggregation) Field(field string) *SignificantTermsAggregation {
	a.field = field
	return a
}

func (a *SignificantTermsAggregation) SubAggregation(name string, subAggregation Aggregation) *SignificantTermsAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *SignificantTermsAggregation) Meta(metaData map[string]interface{}) *SignificantTermsAggregation {
	a.meta = metaData
	return a
}

func (a *SignificantTermsAggregation) MinDocCount(minDocCount int) *SignificantTermsAggregation {
	a.minDocCount = &minDocCount
	return a
}

func (a *SignificantTermsAggregation) ShardMinDocCount(shardMinDocCount int) *SignificantTermsAggregation {
	a.shardMinDocCount = &shardMinDocCount
	return a
}

func (a *SignificantTermsAggregation) RequiredSize(requiredSize int) *SignificantTermsAggregation {
	a.requiredSize = &requiredSize
	return a
}

func (a *SignificantTermsAggregation) ShardSize(shardSize int) *SignificantTermsAggregation {
	a.shardSize = &shardSize
	return a
}

func (a *SignificantTermsAggregation) BackgroundFilter(filter Query) *SignificantTermsAggregation {
	a.filter = filter
	return a
}

func (a *SignificantTermsAggregation) ExecutionHint(hint string) *SignificantTermsAggregation {
	a.executionHint = hint
	return a
}

func (a *SignificantTermsAggregation) SignificanceHeuristic(heuristic SignificanceHeuristic) *SignificantTermsAggregation {
	a.significanceHeuristic = heuristic
	return a
}

func (a *SignificantTermsAggregation) Source() (interface{}, error) {
	// Example:
	// {
	//     "query" : {
	//         "terms" : {"force" : [ "British Transport Police" ]}
	//     },
	//     "aggregations" : {
	//         "significantCrimeTypes" : {
	//             "significant_terms" : { "field" : "crime_type" }
	//         }
	//     }
	// }
	//
	// This method returns only the
	//   { "significant_terms" : { "field" : "crime_type" }
	// part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["significant_terms"] = opts

	if a.field != "" {
		opts["field"] = a.field
	}
	if a.requiredSize != nil {
		opts["size"] = *a.requiredSize // not a typo!
	}
	if a.shardSize != nil {
		opts["shard_size"] = *a.shardSize
	}
	if a.minDocCount != nil {
		opts["min_doc_count"] = *a.minDocCount
	}
	if a.shardMinDocCount != nil {
		opts["shard_min_doc_count"] = *a.shardMinDocCount
	}
	if a.executionHint != "" {
		opts["execution_hint"] = a.executionHint
	}
	if a.filter != nil {
		src, err := a.filter.Source()
		if err != nil {
			return nil, err
		}
		opts["background_filter"] = src
	}
	if a.significanceHeuristic != nil {
		name := a.significanceHeuristic.Name()
		src, err := a.significanceHeuristic.Source()
		if err != nil {
			return nil, err
		}
		opts[name] = src
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

// -- Significance heuristics --

type SignificanceHeuristic interface {
	Name() string
	Source() (interface{}, error)
}

// -- Chi Square --

// ChiSquareSignificanceHeuristic implements Chi square as described
// in "Information Retrieval", Manning et al., Chapter 13.5.2.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html#_chi_square
// for details.
type ChiSquareSignificanceHeuristic struct {
	backgroundIsSuperset *bool
	includeNegatives     *bool
}

// NewChiSquareSignificanceHeuristic initializes a new ChiSquareSignificanceHeuristic.
func NewChiSquareSignificanceHeuristic() *ChiSquareSignificanceHeuristic {
	return &ChiSquareSignificanceHeuristic{}
}

// Name returns the name of the heuristic in the REST interface.
func (sh *ChiSquareSignificanceHeuristic) Name() string {
	return "chi_square"
}

// BackgroundIsSuperset indicates whether you defined a custom background
// filter that represents a difference set of documents that you want to
// compare to.
func (sh *ChiSquareSignificanceHeuristic) BackgroundIsSuperset(backgroundIsSuperset bool) *ChiSquareSignificanceHeuristic {
	sh.backgroundIsSuperset = &backgroundIsSuperset
	return sh
}

// IncludeNegatives indicates whether to filter out the terms that appear
// much less in the subset than in the background without the subset.
func (sh *ChiSquareSignificanceHeuristic) IncludeNegatives(includeNegatives bool) *ChiSquareSignificanceHeuristic {
	sh.includeNegatives = &includeNegatives
	return sh
}

// Source returns the parameters that need to be added to the REST parameters.
func (sh *ChiSquareSignificanceHeuristic) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if sh.backgroundIsSuperset != nil {
		source["background_is_superset"] = *sh.backgroundIsSuperset
	}
	if sh.includeNegatives != nil {
		source["include_negatives"] = *sh.includeNegatives
	}
	return source, nil
}

// -- GND --

// GNDSignificanceHeuristic implements the "Google Normalized Distance"
// as described in "The Google Similarity Distance", Cilibrasi and Vitanyi,
// 2007.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html#_google_normalized_distance
// for details.
type GNDSignificanceHeuristic struct {
	backgroundIsSuperset *bool
}

// NewGNDSignificanceHeuristic implements a new GNDSignificanceHeuristic.
func NewGNDSignificanceHeuristic() *GNDSignificanceHeuristic {
	return &GNDSignificanceHeuristic{}
}

// Name returns the name of the heuristic in the REST interface.
func (sh *GNDSignificanceHeuristic) Name() string {
	return "gnd"
}

// BackgroundIsSuperset indicates whether you defined a custom background
// filter that represents a difference set of documents that you want to
// compare to.
func (sh *GNDSignificanceHeuristic) BackgroundIsSuperset(backgroundIsSuperset bool) *GNDSignificanceHeuristic {
	sh.backgroundIsSuperset = &backgroundIsSuperset
	return sh
}

// Source returns the parameters that need to be added to the REST parameters.
func (sh *GNDSignificanceHeuristic) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if sh.backgroundIsSuperset != nil {
		source["background_is_superset"] = *sh.backgroundIsSuperset
	}
	return source, nil
}

// -- JLH Score --

// JLHScoreSignificanceHeuristic implements the JLH score as described in
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html#_jlh_score.
type JLHScoreSignificanceHeuristic struct{}

// NewJLHScoreSignificanceHeuristic initializes a new JLHScoreSignificanceHeuristic.
func NewJLHScoreSignificanceHeuristic() *JLHScoreSignificanceHeuristic {
	return &JLHScoreSignificanceHeuristic{}
}

// Name returns the name of the heuristic in the REST interface.
func (sh *JLHScoreSignificanceHeuristic) Name() string {
	return "jlh"
}

// Source returns the parameters that need to be added to the REST parameters.
func (sh *JLHScoreSignificanceHeuristic) Source() (interface{}, error) {
	source := make(map[string]interface{})
	return source, nil
}

// -- Mutual Information --

// MutualInformationSignificanceHeuristic implements Mutual information
// as described in "Information Retrieval", Manning et al., Chapter 13.5.1.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html#_mutual_information
// for details.
type MutualInformationSignificanceHeuristic struct {
	backgroundIsSuperset *bool
	includeNegatives     *bool
}

// NewMutualInformationSignificanceHeuristic initializes a new instance of
// MutualInformationSignificanceHeuristic.
func NewMutualInformationSignificanceHeuristic() *MutualInformationSignificanceHeuristic {
	return &MutualInformationSignificanceHeuristic{}
}

// Name returns the name of the heuristic in the REST interface.
func (sh *MutualInformationSignificanceHeuristic) Name() string {
	return "mutual_information"
}

// BackgroundIsSuperset indicates whether you defined a custom background
// filter that represents a difference set of documents that you want to
// compare to.
func (sh *MutualInformationSignificanceHeuristic) BackgroundIsSuperset(backgroundIsSuperset bool) *MutualInformationSignificanceHeuristic {
	sh.backgroundIsSuperset = &backgroundIsSuperset
	return sh
}

// IncludeNegatives indicates whether to filter out the terms that appear
// much less in the subset than in the background without the subset.
func (sh *MutualInformationSignificanceHeuristic) IncludeNegatives(includeNegatives bool) *MutualInformationSignificanceHeuristic {
	sh.includeNegatives = &includeNegatives
	return sh
}

// Source returns the parameters that need to be added to the REST parameters.
func (sh *MutualInformationSignificanceHeuristic) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if sh.backgroundIsSuperset != nil {
		source["background_is_superset"] = *sh.backgroundIsSuperset
	}
	if sh.includeNegatives != nil {
		source["include_negatives"] = *sh.includeNegatives
	}
	return source, nil
}

// -- Percentage Score --

// PercentageScoreSignificanceHeuristic implements the algorithm described
// in https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html#_percentage.
type PercentageScoreSignificanceHeuristic struct{}

// NewPercentageScoreSignificanceHeuristic initializes a new instance of
// PercentageScoreSignificanceHeuristic.
func NewPercentageScoreSignificanceHeuristic() *PercentageScoreSignificanceHeuristic {
	return &PercentageScoreSignificanceHeuristic{}
}

// Name returns the name of the heuristic in the REST interface.
func (sh *PercentageScoreSignificanceHeuristic) Name() string {
	return "percentage"
}

// Source returns the parameters that need to be added to the REST parameters.
func (sh *PercentageScoreSignificanceHeuristic) Source() (interface{}, error) {
	source := make(map[string]interface{})
	return source, nil
}

// -- Script --

// ScriptSignificanceHeuristic implements a scripted significance heuristic.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html#_scripted
// for details.
type ScriptSignificanceHeuristic struct {
	script *Script
}

// NewScriptSignificanceHeuristic initializes a new instance of
// ScriptSignificanceHeuristic.
func NewScriptSignificanceHeuristic() *ScriptSignificanceHeuristic {
	return &ScriptSignificanceHeuristic{}
}

// Name returns the name of the heuristic in the REST interface.
func (sh *ScriptSignificanceHeuristic) Name() string {
	return "script_heuristic"
}

// Script specifies the script to use to get custom scores. The following
// parameters are available in the script: `_subset_freq`, `_superset_freq`,
// `_subset_size`, and `_superset_size`.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html#_scripted
// for details.
func (sh *ScriptSignificanceHeuristic) Script(script *Script) *ScriptSignificanceHeuristic {
	sh.script = script
	return sh
}

// Source returns the parameters that need to be added to the REST parameters.
func (sh *ScriptSignificanceHeuristic) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if sh.script != nil {
		src, err := sh.script.Source()
		if err != nil {
			return nil, err
		}
		source["script"] = src
	}
	return source, nil
}
