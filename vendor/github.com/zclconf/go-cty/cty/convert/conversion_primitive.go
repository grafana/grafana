package convert

import (
	"strings"

	"github.com/zclconf/go-cty/cty"
)

var stringTrue = cty.StringVal("true")
var stringFalse = cty.StringVal("false")

var primitiveConversionsSafe = map[cty.Type]map[cty.Type]conversion{
	cty.Number: {
		cty.String: func(val cty.Value, path cty.Path) (cty.Value, error) {
			f := val.AsBigFloat()
			return cty.StringVal(f.Text('f', -1)), nil
		},
	},
	cty.Bool: {
		cty.String: func(val cty.Value, path cty.Path) (cty.Value, error) {
			if val.True() {
				return stringTrue, nil
			} else {
				return stringFalse, nil
			}
		},
	},
}

var primitiveConversionsUnsafe = map[cty.Type]map[cty.Type]conversion{
	cty.String: {
		cty.Number: func(val cty.Value, path cty.Path) (cty.Value, error) {
			v, err := cty.ParseNumberVal(val.AsString())
			if err != nil {
				return cty.NilVal, path.NewErrorf("a number is required")
			}
			return v, nil
		},
		cty.Bool: func(val cty.Value, path cty.Path) (cty.Value, error) {
			switch val.AsString() {
			case "true", "1":
				return cty.True, nil
			case "false", "0":
				return cty.False, nil
			default:
				switch strings.ToLower(val.AsString()) {
				case "true":
					return cty.NilVal, path.NewErrorf("a bool is required; to convert from string, use lowercase \"true\"")
				case "false":
					return cty.NilVal, path.NewErrorf("a bool is required; to convert from string, use lowercase \"false\"")
				default:
					return cty.NilVal, path.NewErrorf("a bool is required")
				}
			}
		},
	},
}
