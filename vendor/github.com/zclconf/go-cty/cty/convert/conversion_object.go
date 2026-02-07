package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// conversionObjectToObject returns a conversion that will make the input
// object type conform to the output object type, if possible.
//
// Conversion is possible only if the output type is a subset of the input
// type, meaning that each attribute of the output type has a corresponding
// attribute in the input type where a recursive conversion is available.
//
// If the "out" type has any optional attributes, those attributes may be
// absent in the "in" type, in which case null values will be used in their
// place in the result.
//
// Shallow object conversions work the same for both safe and unsafe modes,
// but the safety flag is passed on to recursive conversions and may thus
// limit the above definition of "subset".
func conversionObjectToObject(in, out cty.Type, unsafe bool) conversion {
	inAtys := in.AttributeTypes()
	outAtys := out.AttributeTypes()
	outOptionals := out.OptionalAttributes()
	attrConvs := make(map[string]conversion)

	for name, outAty := range outAtys {
		inAty, exists := inAtys[name]
		if !exists {
			if _, optional := outOptionals[name]; optional {
				// If it's optional then we'll skip inserting an
				// attribute conversion and then deal with inserting
				// the default value in our overall conversion logic
				// later.
				continue
			}
			// No conversion is available, then.
			return nil
		}

		if inAty.Equals(outAty) {
			// No conversion needed, but we'll still record the attribute
			// in our map for later reference.
			attrConvs[name] = nil
			continue
		}

		attrConvs[name] = getConversion(inAty, outAty, unsafe)
		if attrConvs[name] == nil {
			// If a recursive conversion isn't available, then our top-level
			// configuration is impossible too.
			return nil
		}
	}

	// If we get here then a conversion is possible, using the attribute
	// conversions given in attrConvs.
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		attrVals := make(map[string]cty.Value, len(attrConvs))
		path = append(path, nil)
		pathStep := &path[len(path)-1]

		for it := val.ElementIterator(); it.Next(); {
			nameVal, val := it.Element()
			var err error

			name := nameVal.AsString()
			*pathStep = cty.GetAttrStep{
				Name: name,
			}

			conv, exists := attrConvs[name]
			if !exists {
				continue
			}
			if conv != nil {
				val, err = conv(val, path)
				if err != nil {
					return cty.NilVal, err
				}
			}

			if val.IsNull() {
				// Strip optional attributes out of the embedded type for null
				// values.
				val = cty.NullVal(val.Type().WithoutOptionalAttributesDeep())
			}

			attrVals[name] = val
		}

		for name := range outOptionals {
			if _, exists := attrVals[name]; !exists {
				wantTy := outAtys[name]
				attrVals[name] = cty.NullVal(wantTy.WithoutOptionalAttributesDeep())
			}
		}

		return cty.ObjectVal(attrVals), nil
	}
}
