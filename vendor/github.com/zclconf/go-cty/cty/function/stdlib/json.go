package stdlib

import (
	"bytes"
	"strings"
	"unicode/utf8"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
	"github.com/zclconf/go-cty/cty/json"
)

var JSONEncodeFunc = function.New(&function.Spec{
	Description: `Returns a string containing a JSON representation of the given value.`,
	Params: []function.Parameter{
		{
			Name:             "val",
			Type:             cty.DynamicPseudoType,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowNull:        true,
		},
	},
	Type:         function.StaticReturnType(cty.String),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		val := args[0]
		if !val.IsWhollyKnown() {
			// We can't serialize unknowns, so if the value is unknown or
			// contains any _nested_ unknowns then our result must be
			// unknown. However, we might still be able to at least constrain
			// the prefix of our string so that downstreams can sniff for
			// whether it's valid JSON and what result types it could have.

			valRng := val.Range()
			if valRng.CouldBeNull() {
				// If null is possible then we can't constrain the result
				// beyond the type constraint, because the very first character
				// of the string is what distinguishes a null.
				return cty.UnknownVal(retType), nil
			}
			b := cty.UnknownVal(retType).Refine()
			ty := valRng.TypeConstraint()
			switch {
			case ty == cty.String:
				b = b.StringPrefixFull(`"`)
			case ty.IsObjectType() || ty.IsMapType():
				b = b.StringPrefixFull("{")
			case ty.IsTupleType() || ty.IsListType() || ty.IsSetType():
				b = b.StringPrefixFull("[")
			}
			return b.NewValue(), nil
		}

		if val.IsNull() {
			return cty.StringVal("null"), nil
		}

		buf, err := json.Marshal(val, val.Type())
		if err != nil {
			return cty.NilVal, err
		}

		// json.Marshal should already produce a trimmed string, but we'll
		// make sure it always is because our unknown value refinements above
		// assume there will be no leading whitespace before the value.
		buf = bytes.TrimSpace(buf)

		return cty.StringVal(string(buf)), nil
	},
})

var JSONDecodeFunc = function.New(&function.Spec{
	Description: `Parses the given string as JSON and returns a value corresponding to what the JSON document describes.`,
	Params: []function.Parameter{
		{
			Name: "str",
			Type: cty.String,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		str := args[0]
		if !str.IsKnown() {
			// If the string isn't known then we can't fully parse it, but
			// if the value has been refined with a prefix then we may at
			// least be able to reject obviously-invalid syntax and maybe
			// even predict the result type. It's safe to return a specific
			// result type only if parsing a full document with this prefix
			// would return exactly that type or fail with a syntax error.
			rng := str.Range()
			if prefix := strings.TrimSpace(rng.StringPrefix()); prefix != "" {
				// If we know at least one character then it should be one
				// of the few characters that can introduce a JSON value.
				switch r, _ := utf8.DecodeRuneInString(prefix); r {
				case '{', '[':
					// These can start object values and array values
					// respectively, but we can't actually form a full
					// object type constraint or tuple type constraint
					// without knowing all of the attributes, so we
					// will still return DynamicPseudoType in this case.
				case '"':
					// This means that the result will either be a string
					// or parsing will fail.
					return cty.String, nil
				case 't', 'f':
					// Must either be a boolean value or a syntax error.
					return cty.Bool, nil
				case '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.':
					// These characters would all start the "number" production.
					return cty.Number, nil
				case 'n':
					// n is valid to begin the keyword "null" but that doesn't
					// give us any extra type information.
				default:
					// No other characters are valid as the beginning of a
					// JSON value, so we can safely return an early error.
					return cty.NilType, function.NewArgErrorf(0, "a JSON document cannot begin with the character %q", r)
				}
			}
			return cty.DynamicPseudoType, nil
		}

		buf := []byte(str.AsString())
		return json.ImpliedType(buf)
	},
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		buf := []byte(args[0].AsString())
		return json.Unmarshal(buf, retType)
	},
})

// JSONEncode returns a JSON serialization of the given value.
func JSONEncode(val cty.Value) (cty.Value, error) {
	return JSONEncodeFunc.Call([]cty.Value{val})
}

// JSONDecode parses the given JSON string and, if it is valid, returns the
// value it represents.
//
// Note that applying JSONDecode to the result of JSONEncode may not produce
// an identically-typed result, since JSON encoding is lossy for cty Types.
// The resulting value will consist only of primitive types, object types, and
// tuple types.
func JSONDecode(str cty.Value) (cty.Value, error) {
	return JSONDecodeFunc.Call([]cty.Value{str})
}
