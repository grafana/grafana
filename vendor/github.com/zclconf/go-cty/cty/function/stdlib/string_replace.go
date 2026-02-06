package stdlib

import (
	"regexp"
	"strings"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
)

// ReplaceFunc is a function that searches a given string for another given
// substring, and replaces each occurence with a given replacement string.
// The substr argument is a simple string.
var ReplaceFunc = function.New(&function.Spec{
	Description: `Replaces all instances of the given substring in the given string with the given replacement string.`,
	Params: []function.Parameter{
		{
			Name:        "str",
			Description: `The string to search within.`,
			Type:        cty.String,
		},
		{
			Name:        "substr",
			Description: `The substring to search for.`,
			Type:        cty.String,
		},
		{
			Name:        "replace",
			Description: `The new substring to replace substr with.`,
			Type:        cty.String,
		},
	},
	Type:         function.StaticReturnType(cty.String),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		str := args[0].AsString()
		substr := args[1].AsString()
		replace := args[2].AsString()

		return cty.StringVal(strings.Replace(str, substr, replace, -1)), nil
	},
})

// RegexReplaceFunc is a function that searches a given string for another
// given substring, and replaces each occurence with a given replacement
// string. The substr argument must be a valid regular expression.
var RegexReplaceFunc = function.New(&function.Spec{
	Description: `Applies the given regular expression pattern to the given string and replaces all matches with the given replacement string.`,
	Params: []function.Parameter{
		{
			Name: "str",
			Type: cty.String,
		},
		{
			Name: "pattern",
			Type: cty.String,
		},
		{
			Name: "replace",
			Type: cty.String,
		},
	},
	Type:         function.StaticReturnType(cty.String),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		str := args[0].AsString()
		substr := args[1].AsString()
		replace := args[2].AsString()

		re, err := regexp.Compile(substr)
		if err != nil {
			return cty.UnknownVal(cty.String), err
		}

		return cty.StringVal(re.ReplaceAllString(str, replace)), nil
	},
})

// Replace searches a given string for another given substring,
// and replaces all occurrences with a given replacement string.
func Replace(str, substr, replace cty.Value) (cty.Value, error) {
	return ReplaceFunc.Call([]cty.Value{str, substr, replace})
}

func RegexReplace(str, substr, replace cty.Value) (cty.Value, error) {
	return RegexReplaceFunc.Call([]cty.Value{str, substr, replace})
}
