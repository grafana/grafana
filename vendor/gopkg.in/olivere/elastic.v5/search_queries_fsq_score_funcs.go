// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"strings"
)

// ScoreFunction is used in combination with the Function Score Query.
type ScoreFunction interface {
	Name() string
	GetWeight() *float64 // returns the weight which must be serialized at the level of FunctionScoreQuery
	Source() (interface{}, error)
}

// -- Exponential Decay --

// ExponentialDecayFunction builds an exponential decay score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html
// for details.
type ExponentialDecayFunction struct {
	fieldName      string
	origin         interface{}
	scale          interface{}
	decay          *float64
	offset         interface{}
	multiValueMode string
	weight         *float64
}

// NewExponentialDecayFunction creates a new ExponentialDecayFunction.
func NewExponentialDecayFunction() *ExponentialDecayFunction {
	return &ExponentialDecayFunction{}
}

// Name represents the JSON field name under which the output of Source
// needs to be serialized by FunctionScoreQuery (see FunctionScoreQuery.Source).
func (fn *ExponentialDecayFunction) Name() string {
	return "exp"
}

// FieldName specifies the name of the field to which this decay function is applied to.
func (fn *ExponentialDecayFunction) FieldName(fieldName string) *ExponentialDecayFunction {
	fn.fieldName = fieldName
	return fn
}

// Origin defines the "central point" by which the decay function calculates
// "distance".
func (fn *ExponentialDecayFunction) Origin(origin interface{}) *ExponentialDecayFunction {
	fn.origin = origin
	return fn
}

// Scale defines the scale to be used with Decay.
func (fn *ExponentialDecayFunction) Scale(scale interface{}) *ExponentialDecayFunction {
	fn.scale = scale
	return fn
}

// Decay defines how documents are scored at the distance given a Scale.
// If no decay is defined, documents at the distance Scale will be scored 0.5.
func (fn *ExponentialDecayFunction) Decay(decay float64) *ExponentialDecayFunction {
	fn.decay = &decay
	return fn
}

// Offset, if defined, computes the decay function only for a distance
// greater than the defined offset.
func (fn *ExponentialDecayFunction) Offset(offset interface{}) *ExponentialDecayFunction {
	fn.offset = offset
	return fn
}

// Weight adjusts the score of the score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_using_function_score
// for details.
func (fn *ExponentialDecayFunction) Weight(weight float64) *ExponentialDecayFunction {
	fn.weight = &weight
	return fn
}

// GetWeight returns the adjusted score. It is part of the ScoreFunction interface.
// Returns nil if weight is not specified.
func (fn *ExponentialDecayFunction) GetWeight() *float64 {
	return fn.weight
}

// MultiValueMode specifies how the decay function should be calculated
// on a field that has multiple values.
// Valid modes are: min, max, avg, and sum.
func (fn *ExponentialDecayFunction) MultiValueMode(mode string) *ExponentialDecayFunction {
	fn.multiValueMode = mode
	return fn
}

// Source returns the serializable JSON data of this score function.
func (fn *ExponentialDecayFunction) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source[fn.fieldName] = params
	if fn.origin != nil {
		params["origin"] = fn.origin
	}
	params["scale"] = fn.scale
	if fn.decay != nil && *fn.decay > 0 {
		params["decay"] = *fn.decay
	}
	if fn.offset != nil {
		params["offset"] = fn.offset
	}
	if fn.multiValueMode != "" {
		source["multi_value_mode"] = fn.multiValueMode
	}
	return source, nil
}

// -- Gauss Decay --

// GaussDecayFunction builds a gauss decay score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html
// for details.
type GaussDecayFunction struct {
	fieldName      string
	origin         interface{}
	scale          interface{}
	decay          *float64
	offset         interface{}
	multiValueMode string
	weight         *float64
}

// NewGaussDecayFunction returns a new GaussDecayFunction.
func NewGaussDecayFunction() *GaussDecayFunction {
	return &GaussDecayFunction{}
}

// Name represents the JSON field name under which the output of Source
// needs to be serialized by FunctionScoreQuery (see FunctionScoreQuery.Source).
func (fn *GaussDecayFunction) Name() string {
	return "gauss"
}

// FieldName specifies the name of the field to which this decay function is applied to.
func (fn *GaussDecayFunction) FieldName(fieldName string) *GaussDecayFunction {
	fn.fieldName = fieldName
	return fn
}

// Origin defines the "central point" by which the decay function calculates
// "distance".
func (fn *GaussDecayFunction) Origin(origin interface{}) *GaussDecayFunction {
	fn.origin = origin
	return fn
}

// Scale defines the scale to be used with Decay.
func (fn *GaussDecayFunction) Scale(scale interface{}) *GaussDecayFunction {
	fn.scale = scale
	return fn
}

// Decay defines how documents are scored at the distance given a Scale.
// If no decay is defined, documents at the distance Scale will be scored 0.5.
func (fn *GaussDecayFunction) Decay(decay float64) *GaussDecayFunction {
	fn.decay = &decay
	return fn
}

// Offset, if defined, computes the decay function only for a distance
// greater than the defined offset.
func (fn *GaussDecayFunction) Offset(offset interface{}) *GaussDecayFunction {
	fn.offset = offset
	return fn
}

// Weight adjusts the score of the score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_using_function_score
// for details.
func (fn *GaussDecayFunction) Weight(weight float64) *GaussDecayFunction {
	fn.weight = &weight
	return fn
}

// GetWeight returns the adjusted score. It is part of the ScoreFunction interface.
// Returns nil if weight is not specified.
func (fn *GaussDecayFunction) GetWeight() *float64 {
	return fn.weight
}

// MultiValueMode specifies how the decay function should be calculated
// on a field that has multiple values.
// Valid modes are: min, max, avg, and sum.
func (fn *GaussDecayFunction) MultiValueMode(mode string) *GaussDecayFunction {
	fn.multiValueMode = mode
	return fn
}

// Source returns the serializable JSON data of this score function.
func (fn *GaussDecayFunction) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source[fn.fieldName] = params
	if fn.origin != nil {
		params["origin"] = fn.origin
	}
	params["scale"] = fn.scale
	if fn.decay != nil && *fn.decay > 0 {
		params["decay"] = *fn.decay
	}
	if fn.offset != nil {
		params["offset"] = fn.offset
	}
	if fn.multiValueMode != "" {
		source["multi_value_mode"] = fn.multiValueMode
	}
	// Notice that the weight has to be serialized in FunctionScoreQuery.
	return source, nil
}

// -- Linear Decay --

// LinearDecayFunction builds a linear decay score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html
// for details.
type LinearDecayFunction struct {
	fieldName      string
	origin         interface{}
	scale          interface{}
	decay          *float64
	offset         interface{}
	multiValueMode string
	weight         *float64
}

// NewLinearDecayFunction initializes and returns a new LinearDecayFunction.
func NewLinearDecayFunction() *LinearDecayFunction {
	return &LinearDecayFunction{}
}

// Name represents the JSON field name under which the output of Source
// needs to be serialized by FunctionScoreQuery (see FunctionScoreQuery.Source).
func (fn *LinearDecayFunction) Name() string {
	return "linear"
}

// FieldName specifies the name of the field to which this decay function is applied to.
func (fn *LinearDecayFunction) FieldName(fieldName string) *LinearDecayFunction {
	fn.fieldName = fieldName
	return fn
}

// Origin defines the "central point" by which the decay function calculates
// "distance".
func (fn *LinearDecayFunction) Origin(origin interface{}) *LinearDecayFunction {
	fn.origin = origin
	return fn
}

// Scale defines the scale to be used with Decay.
func (fn *LinearDecayFunction) Scale(scale interface{}) *LinearDecayFunction {
	fn.scale = scale
	return fn
}

// Decay defines how documents are scored at the distance given a Scale.
// If no decay is defined, documents at the distance Scale will be scored 0.5.
func (fn *LinearDecayFunction) Decay(decay float64) *LinearDecayFunction {
	fn.decay = &decay
	return fn
}

// Offset, if defined, computes the decay function only for a distance
// greater than the defined offset.
func (fn *LinearDecayFunction) Offset(offset interface{}) *LinearDecayFunction {
	fn.offset = offset
	return fn
}

// Weight adjusts the score of the score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_using_function_score
// for details.
func (fn *LinearDecayFunction) Weight(weight float64) *LinearDecayFunction {
	fn.weight = &weight
	return fn
}

// GetWeight returns the adjusted score. It is part of the ScoreFunction interface.
// Returns nil if weight is not specified.
func (fn *LinearDecayFunction) GetWeight() *float64 {
	return fn.weight
}

// MultiValueMode specifies how the decay function should be calculated
// on a field that has multiple values.
// Valid modes are: min, max, avg, and sum.
func (fn *LinearDecayFunction) MultiValueMode(mode string) *LinearDecayFunction {
	fn.multiValueMode = mode
	return fn
}

// GetMultiValueMode returns how the decay function should be calculated
// on a field that has multiple values.
// Valid modes are: min, max, avg, and sum.
func (fn *LinearDecayFunction) GetMultiValueMode() string {
	return fn.multiValueMode
}

// Source returns the serializable JSON data of this score function.
func (fn *LinearDecayFunction) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source[fn.fieldName] = params
	if fn.origin != nil {
		params["origin"] = fn.origin
	}
	params["scale"] = fn.scale
	if fn.decay != nil && *fn.decay > 0 {
		params["decay"] = *fn.decay
	}
	if fn.offset != nil {
		params["offset"] = fn.offset
	}
	if fn.multiValueMode != "" {
		source["multi_value_mode"] = fn.multiValueMode
	}
	// Notice that the weight has to be serialized in FunctionScoreQuery.
	return source, nil
}

// -- Script --

// ScriptFunction builds a script score function. It uses a script to
// compute or influence the score of documents that match with the inner
// query or filter.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_script_score
// for details.
type ScriptFunction struct {
	script *Script
	weight *float64
}

// NewScriptFunction initializes and returns a new ScriptFunction.
func NewScriptFunction(script *Script) *ScriptFunction {
	return &ScriptFunction{
		script: script,
	}
}

// Name represents the JSON field name under which the output of Source
// needs to be serialized by FunctionScoreQuery (see FunctionScoreQuery.Source).
func (fn *ScriptFunction) Name() string {
	return "script_score"
}

// Script specifies the script to be executed.
func (fn *ScriptFunction) Script(script *Script) *ScriptFunction {
	fn.script = script
	return fn
}

// Weight adjusts the score of the score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_using_function_score
// for details.
func (fn *ScriptFunction) Weight(weight float64) *ScriptFunction {
	fn.weight = &weight
	return fn
}

// GetWeight returns the adjusted score. It is part of the ScoreFunction interface.
// Returns nil if weight is not specified.
func (fn *ScriptFunction) GetWeight() *float64 {
	return fn.weight
}

// Source returns the serializable JSON data of this score function.
func (fn *ScriptFunction) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if fn.script != nil {
		src, err := fn.script.Source()
		if err != nil {
			return nil, err
		}
		source["script"] = src
	}
	// Notice that the weight has to be serialized in FunctionScoreQuery.
	return source, nil
}

// -- Field value factor --

// FieldValueFactorFunction is a function score function that allows you
// to use a field from a document to influence the score.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_field_value_factor.
type FieldValueFactorFunction struct {
	field    string
	factor   *float64
	missing  *float64
	weight   *float64
	modifier string
}

// NewFieldValueFactorFunction initializes and returns a new FieldValueFactorFunction.
func NewFieldValueFactorFunction() *FieldValueFactorFunction {
	return &FieldValueFactorFunction{}
}

// Name represents the JSON field name under which the output of Source
// needs to be serialized by FunctionScoreQuery (see FunctionScoreQuery.Source).
func (fn *FieldValueFactorFunction) Name() string {
	return "field_value_factor"
}

// Field is the field to be extracted from the document.
func (fn *FieldValueFactorFunction) Field(field string) *FieldValueFactorFunction {
	fn.field = field
	return fn
}

// Factor is the (optional) factor to multiply the field with. If you do not
// specify a factor, the default is 1.
func (fn *FieldValueFactorFunction) Factor(factor float64) *FieldValueFactorFunction {
	fn.factor = &factor
	return fn
}

// Modifier to apply to the field value. It can be one of: none, log, log1p,
// log2p, ln, ln1p, ln2p, square, sqrt, or reciprocal. Defaults to: none.
func (fn *FieldValueFactorFunction) Modifier(modifier string) *FieldValueFactorFunction {
	fn.modifier = modifier
	return fn
}

// Weight adjusts the score of the score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_using_function_score
// for details.
func (fn *FieldValueFactorFunction) Weight(weight float64) *FieldValueFactorFunction {
	fn.weight = &weight
	return fn
}

// GetWeight returns the adjusted score. It is part of the ScoreFunction interface.
// Returns nil if weight is not specified.
func (fn *FieldValueFactorFunction) GetWeight() *float64 {
	return fn.weight
}

// Missing is used if a document does not have that field.
func (fn *FieldValueFactorFunction) Missing(missing float64) *FieldValueFactorFunction {
	fn.missing = &missing
	return fn
}

// Source returns the serializable JSON data of this score function.
func (fn *FieldValueFactorFunction) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if fn.field != "" {
		source["field"] = fn.field
	}
	if fn.factor != nil {
		source["factor"] = *fn.factor
	}
	if fn.missing != nil {
		source["missing"] = *fn.missing
	}
	if fn.modifier != "" {
		source["modifier"] = strings.ToLower(fn.modifier)
	}
	// Notice that the weight has to be serialized in FunctionScoreQuery.
	return source, nil
}

// -- Weight Factor --

// WeightFactorFunction builds a weight factor function that multiplies
// the weight to the score.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_weight
// for details.
type WeightFactorFunction struct {
	weight float64
}

// NewWeightFactorFunction initializes and returns a new WeightFactorFunction.
func NewWeightFactorFunction(weight float64) *WeightFactorFunction {
	return &WeightFactorFunction{weight: weight}
}

// Name represents the JSON field name under which the output of Source
// needs to be serialized by FunctionScoreQuery (see FunctionScoreQuery.Source).
func (fn *WeightFactorFunction) Name() string {
	return "weight"
}

// Weight adjusts the score of the score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_using_function_score
// for details.
func (fn *WeightFactorFunction) Weight(weight float64) *WeightFactorFunction {
	fn.weight = weight
	return fn
}

// GetWeight returns the adjusted score. It is part of the ScoreFunction interface.
// Returns nil if weight is not specified.
func (fn *WeightFactorFunction) GetWeight() *float64 {
	return &fn.weight
}

// Source returns the serializable JSON data of this score function.
func (fn *WeightFactorFunction) Source() (interface{}, error) {
	// Notice that the weight has to be serialized in FunctionScoreQuery.
	return fn.weight, nil
}

// -- Random --

// RandomFunction builds a random score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_random
// for details.
type RandomFunction struct {
	seed   interface{}
	weight *float64
}

// NewRandomFunction initializes and returns a new RandomFunction.
func NewRandomFunction() *RandomFunction {
	return &RandomFunction{}
}

// Name represents the JSON field name under which the output of Source
// needs to be serialized by FunctionScoreQuery (see FunctionScoreQuery.Source).
func (fn *RandomFunction) Name() string {
	return "random_score"
}

// Seed is documented in 1.6 as a numeric value. However, in the source code
// of the Java client, it also accepts strings. So we accept both here, too.
func (fn *RandomFunction) Seed(seed interface{}) *RandomFunction {
	fn.seed = seed
	return fn
}

// Weight adjusts the score of the score function.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-function-score-query.html#_using_function_score
// for details.
func (fn *RandomFunction) Weight(weight float64) *RandomFunction {
	fn.weight = &weight
	return fn
}

// GetWeight returns the adjusted score. It is part of the ScoreFunction interface.
// Returns nil if weight is not specified.
func (fn *RandomFunction) GetWeight() *float64 {
	return fn.weight
}

// Source returns the serializable JSON data of this score function.
func (fn *RandomFunction) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if fn.seed != nil {
		source["seed"] = fn.seed
	}
	// Notice that the weight has to be serialized in FunctionScoreQuery.
	return source, nil
}
