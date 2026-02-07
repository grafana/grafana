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

package parser

// Function represents a function of the expression language and is
// used by function nodes.
type Function struct {
	Name         string
	ArgTypes     []ValueType
	Variadic     int
	ReturnType   ValueType
	Experimental bool
}

// EnableExperimentalFunctions controls whether experimentalFunctions are enabled.
var EnableExperimentalFunctions bool

// Functions is a list of all functions supported by PromQL, including their types.
var Functions = map[string]*Function{
	"abs": {
		Name:       "abs",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"absent": {
		Name:       "absent",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"absent_over_time": {
		Name:       "absent_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"acos": {
		Name:       "acos",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"acosh": {
		Name:       "acosh",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"asin": {
		Name:       "asin",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"asinh": {
		Name:       "asinh",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"atan": {
		Name:       "atan",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"atanh": {
		Name:       "atanh",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"avg_over_time": {
		Name:       "avg_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"ceil": {
		Name:       "ceil",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"changes": {
		Name:       "changes",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"clamp": {
		Name:       "clamp",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeScalar, ValueTypeScalar},
		ReturnType: ValueTypeVector,
	},
	"clamp_max": {
		Name:       "clamp_max",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeScalar},
		ReturnType: ValueTypeVector,
	},
	"clamp_min": {
		Name:       "clamp_min",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeScalar},
		ReturnType: ValueTypeVector,
	},
	"cos": {
		Name:       "cos",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"cosh": {
		Name:       "cosh",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"count_over_time": {
		Name:       "count_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"days_in_month": {
		Name:       "days_in_month",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"day_of_month": {
		Name:       "day_of_month",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"day_of_week": {
		Name:       "day_of_week",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"day_of_year": {
		Name:       "day_of_year",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"deg": {
		Name:       "deg",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"delta": {
		Name:       "delta",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"deriv": {
		Name:       "deriv",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"exp": {
		Name:       "exp",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"floor": {
		Name:       "floor",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"histogram_avg": {
		Name:       "histogram_avg",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"histogram_count": {
		Name:       "histogram_count",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"histogram_sum": {
		Name:       "histogram_sum",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"histogram_stddev": {
		Name:       "histogram_stddev",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"histogram_stdvar": {
		Name:       "histogram_stdvar",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"histogram_fraction": {
		Name:       "histogram_fraction",
		ArgTypes:   []ValueType{ValueTypeScalar, ValueTypeScalar, ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"histogram_quantile": {
		Name:       "histogram_quantile",
		ArgTypes:   []ValueType{ValueTypeScalar, ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"double_exponential_smoothing": {
		Name:         "double_exponential_smoothing",
		ArgTypes:     []ValueType{ValueTypeMatrix, ValueTypeScalar, ValueTypeScalar},
		ReturnType:   ValueTypeVector,
		Experimental: true,
	},
	"hour": {
		Name:       "hour",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"idelta": {
		Name:       "idelta",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"increase": {
		Name:       "increase",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"info": {
		Name:         "info",
		ArgTypes:     []ValueType{ValueTypeVector, ValueTypeVector},
		ReturnType:   ValueTypeVector,
		Experimental: true,
		Variadic:     1,
	},
	"irate": {
		Name:       "irate",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"label_replace": {
		Name:       "label_replace",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeString, ValueTypeString, ValueTypeString, ValueTypeString},
		ReturnType: ValueTypeVector,
	},
	"label_join": {
		Name:       "label_join",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeString, ValueTypeString, ValueTypeString},
		Variadic:   -1,
		ReturnType: ValueTypeVector,
	},
	"last_over_time": {
		Name:       "last_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"ln": {
		Name:       "ln",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"log10": {
		Name:       "log10",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"log2": {
		Name:       "log2",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"mad_over_time": {
		Name:         "mad_over_time",
		ArgTypes:     []ValueType{ValueTypeMatrix},
		ReturnType:   ValueTypeVector,
		Experimental: true,
	},
	"max_over_time": {
		Name:       "max_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"min_over_time": {
		Name:       "min_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"minute": {
		Name:       "minute",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"month": {
		Name:       "month",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"pi": {
		Name:       "pi",
		ArgTypes:   []ValueType{},
		ReturnType: ValueTypeScalar,
	},
	"predict_linear": {
		Name:       "predict_linear",
		ArgTypes:   []ValueType{ValueTypeMatrix, ValueTypeScalar},
		ReturnType: ValueTypeVector,
	},
	"present_over_time": {
		Name:       "present_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"quantile_over_time": {
		Name:       "quantile_over_time",
		ArgTypes:   []ValueType{ValueTypeScalar, ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"rad": {
		Name:       "rad",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"rate": {
		Name:       "rate",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"resets": {
		Name:       "resets",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"round": {
		Name:       "round",
		ArgTypes:   []ValueType{ValueTypeVector, ValueTypeScalar},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
	"scalar": {
		Name:       "scalar",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeScalar,
	},
	"sgn": {
		Name:       "sgn",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"sin": {
		Name:       "sin",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"sinh": {
		Name:       "sinh",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"sort": {
		Name:       "sort",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"sort_desc": {
		Name:       "sort_desc",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"sort_by_label": {
		Name:         "sort_by_label",
		ArgTypes:     []ValueType{ValueTypeVector, ValueTypeString},
		Variadic:     -1,
		ReturnType:   ValueTypeVector,
		Experimental: true,
	},
	"sort_by_label_desc": {
		Name:         "sort_by_label_desc",
		ArgTypes:     []ValueType{ValueTypeVector, ValueTypeString},
		Variadic:     -1,
		ReturnType:   ValueTypeVector,
		Experimental: true,
	},
	"sqrt": {
		Name:       "sqrt",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"stddev_over_time": {
		Name:       "stddev_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"stdvar_over_time": {
		Name:       "stdvar_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"sum_over_time": {
		Name:       "sum_over_time",
		ArgTypes:   []ValueType{ValueTypeMatrix},
		ReturnType: ValueTypeVector,
	},
	"tan": {
		Name:       "tan",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"tanh": {
		Name:       "tanh",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"time": {
		Name:       "time",
		ArgTypes:   []ValueType{},
		ReturnType: ValueTypeScalar,
	},
	"timestamp": {
		Name:       "timestamp",
		ArgTypes:   []ValueType{ValueTypeVector},
		ReturnType: ValueTypeVector,
	},
	"vector": {
		Name:       "vector",
		ArgTypes:   []ValueType{ValueTypeScalar},
		ReturnType: ValueTypeVector,
	},
	"year": {
		Name:       "year",
		ArgTypes:   []ValueType{ValueTypeVector},
		Variadic:   1,
		ReturnType: ValueTypeVector,
	},
}

// getFunction returns a predefined Function object for the given name.
func getFunction(name string, functions map[string]*Function) (*Function, bool) {
	function, ok := functions[name]
	return function, ok
}
