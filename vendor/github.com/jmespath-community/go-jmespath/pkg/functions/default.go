package functions

func GetDefaultFunctions() []FunctionEntry {
	return []FunctionEntry{{
		Name: "abs",
		Arguments: []ArgSpec{
			{Types: []JpType{JpNumber}},
		},
		Handler: jpfAbs,
	}, {
		Name: "avg",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArrayNumber}},
		},
		Handler: jpfAvg,
	}, {
		Name: "ceil",
		Arguments: []ArgSpec{
			{Types: []JpType{JpNumber}},
		},
		Handler: jpfCeil,
	}, {
		Name: "contains",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArray, JpString}},
			{Types: []JpType{JpAny}},
		},
		Handler: jpfContains,
	}, {
		Name: "ends_with",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}},
		},
		Handler: jpfEndsWith,
	}, {
		Name: "find_first",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}},
			{Types: []JpType{JpNumber}, Optional: true},
			{Types: []JpType{JpNumber}, Optional: true},
		},
		Handler: jpfFindFirst,
	}, {
		Name: "find_last",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}},
			{Types: []JpType{JpNumber}, Optional: true},
			{Types: []JpType{JpNumber}, Optional: true},
		},
		Handler: jpfFindLast,
	}, {
		Name: "floor",
		Arguments: []ArgSpec{
			{Types: []JpType{JpNumber}},
		},
		Handler: jpfFloor,
	}, {
		Name: "from_items",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArrayArray}},
		},
		Handler: jpfFromItems,
	}, {
		Name: "group_by",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArray}},
			{Types: []JpType{JpExpref}},
		},
		Handler: jpfGroupBy,
	}, {
		Name: "items",
		Arguments: []ArgSpec{
			{Types: []JpType{JpObject}},
		},
		Handler: jpfItems,
	}, {
		Name: "join",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpArrayString}},
		},
		Handler: jpfJoin,
	}, {
		Name: "keys",
		Arguments: []ArgSpec{
			{Types: []JpType{JpObject}},
		},
		Handler: jpfKeys,
	}, {
		Name: "length",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString, JpArray, JpObject}},
		},
		Handler: jpfLength,
	}, {
		Name: "lower",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
		},
		Handler: jpfLower,
	}, {
		Name: "map",
		Arguments: []ArgSpec{
			{Types: []JpType{JpExpref}},
			{Types: []JpType{JpArray}},
		},
		Handler: jpfMap,
	}, {
		Name: "max",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArrayNumber, JpArrayString}},
		},
		Handler: jpfMax,
	}, {
		Name: "max_by",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArray}},
			{Types: []JpType{JpExpref}},
		},
		Handler: jpfMaxBy,
	}, {
		Name: "merge",
		Arguments: []ArgSpec{
			{Types: []JpType{JpObject}, Variadic: true},
		},
		Handler: jpfMerge,
	}, {
		Name: "min",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArrayNumber, JpArrayString}},
		},
		Handler: jpfMin,
	}, {
		Name: "min_by",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArray}},
			{Types: []JpType{JpExpref}},
		},
		Handler: jpfMinBy,
	}, {
		Name: "not_null",
		Arguments: []ArgSpec{
			{Types: []JpType{JpAny}, Variadic: true},
		},
		Handler: jpfNotNull,
	}, {
		Name: "pad_left",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpNumber}},
			{Types: []JpType{JpString}, Optional: true},
		},
		Handler: jpfPadLeft,
	}, {
		Name: "pad_right",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpNumber}},
			{Types: []JpType{JpString}, Optional: true},
		},
		Handler: jpfPadRight,
	}, {
		Name: "replace",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}},
			{Types: []JpType{JpNumber}, Optional: true},
		},
		Handler: jpfReplace,
	}, {
		Name: "reverse",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArray, JpString}},
		},
		Handler: jpfReverse,
	}, {
		Name: "sort",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArrayString, JpArrayNumber}},
		},
		Handler: jpfSort,
	}, {
		Name: "sort_by",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArray}},
			{Types: []JpType{JpExpref}},
		},
		Handler: jpfSortBy,
	}, {
		Name: "split",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}},
			{Types: []JpType{JpNumber}, Optional: true},
		},
		Handler: jpfSplit,
	}, {
		Name: "starts_with",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}},
		},
		Handler: jpfStartsWith,
	}, {
		Name: "sum",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArrayNumber}},
		},
		Handler: jpfSum,
	}, {
		Name: "to_array",
		Arguments: []ArgSpec{
			{Types: []JpType{JpAny}},
		},
		Handler: jpfToArray,
	}, {
		Name: "to_number",
		Arguments: []ArgSpec{
			{Types: []JpType{JpAny}},
		},
		Handler: jpfToNumber,
	}, {
		Name: "to_string",
		Arguments: []ArgSpec{
			{Types: []JpType{JpAny}},
		},
		Handler: jpfToString,
	}, {
		Name: "trim",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}, Optional: true},
		},
		Handler: jpfTrim,
	}, {
		Name: "trim_left",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}, Optional: true},
		},
		Handler: jpfTrimLeft,
	}, {
		Name: "trim_right",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
			{Types: []JpType{JpString}, Optional: true},
		},
		Handler: jpfTrimRight,
	}, {
		Name: "type",
		Arguments: []ArgSpec{
			{Types: []JpType{JpAny}},
		},
		Handler: jpfType,
	}, {
		Name: "upper",
		Arguments: []ArgSpec{
			{Types: []JpType{JpString}},
		},
		Handler: jpfUpper,
	}, {
		Name: "values",
		Arguments: []ArgSpec{
			{Types: []JpType{JpObject}},
		},
		Handler: jpfValues,
	}, {
		Name: "zip",
		Arguments: []ArgSpec{
			{Types: []JpType{JpArray}},
			{Types: []JpType{JpArray}, Variadic: true},
		},
		Handler: jpfZip,
	}}
}
