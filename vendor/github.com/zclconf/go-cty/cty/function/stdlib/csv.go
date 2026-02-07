package stdlib

import (
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
)

var CSVDecodeFunc = function.New(&function.Spec{
	Description: `Parses the given string as Comma Separated Values (as defined by RFC 4180) and returns a map of objects representing the table of data, using the first row as a header row to define the object attributes.`,
	Params: []function.Parameter{
		{
			Name: "str",
			Type: cty.String,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		str := args[0]
		if !str.IsKnown() {
			return cty.DynamicPseudoType, nil
		}

		r := strings.NewReader(str.AsString())
		cr := csv.NewReader(r)
		headers, err := cr.Read()
		if err == io.EOF {
			return cty.DynamicPseudoType, fmt.Errorf("missing header line")
		}
		if err != nil {
			return cty.DynamicPseudoType, csvError(err)
		}

		atys := make(map[string]cty.Type, len(headers))
		for _, name := range headers {
			if _, exists := atys[name]; exists {
				return cty.DynamicPseudoType, fmt.Errorf("duplicate column name %q", name)
			}
			atys[name] = cty.String
		}
		return cty.List(cty.Object(atys)), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		ety := retType.ElementType()
		atys := ety.AttributeTypes()
		str := args[0]
		r := strings.NewReader(str.AsString())
		cr := csv.NewReader(r)
		cr.FieldsPerRecord = len(atys)

		// Read the header row first, since that'll tell us which indices
		// map to which attribute names.
		headers, err := cr.Read()
		if err != nil {
			return cty.DynamicVal, err
		}

		var rows []cty.Value
		for {
			cols, err := cr.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				return cty.DynamicVal, csvError(err)
			}

			vals := make(map[string]cty.Value, len(cols))
			for i, str := range cols {
				name := headers[i]
				vals[name] = cty.StringVal(str)
			}
			rows = append(rows, cty.ObjectVal(vals))
		}

		if len(rows) == 0 {
			return cty.ListValEmpty(ety), nil
		}
		return cty.ListVal(rows), nil
	},
})

// CSVDecode parses the given CSV (RFC 4180) string and, if it is valid,
// returns a list of objects representing the rows.
//
// The result is always a list of some object type. The first row of the
// input is used to determine the object attributes, and subsequent rows
// determine the values of those attributes.
func CSVDecode(str cty.Value) (cty.Value, error) {
	return CSVDecodeFunc.Call([]cty.Value{str})
}

func csvError(err error) error {
	switch err := err.(type) {
	case *csv.ParseError:
		return fmt.Errorf("CSV parse error on line %d: %w", err.Line, err.Err)
	default:
		return err
	}
}
