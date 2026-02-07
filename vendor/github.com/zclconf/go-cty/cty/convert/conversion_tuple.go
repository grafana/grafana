package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// conversionTupleToTuple returns a conversion that will make the input
// tuple type conform to the output tuple type, if possible.
//
// Conversion is possible only if the two tuple types have the same number
// of elements and the corresponding elements by index can be converted.
//
// Shallow tuple conversions work the same for both safe and unsafe modes,
// but the safety flag is passed on to recursive conversions and may thus
// limit which element type conversions are possible.
func conversionTupleToTuple(in, out cty.Type, unsafe bool) conversion {
	inEtys := in.TupleElementTypes()
	outEtys := out.TupleElementTypes()

	if len(inEtys) != len(outEtys) {
		return nil // no conversion is possible
	}

	elemConvs := make([]conversion, len(inEtys))

	for i, outEty := range outEtys {
		inEty := inEtys[i]

		if inEty.Equals(outEty) {
			// No conversion needed, so we can leave this one nil.
			continue
		}

		elemConvs[i] = getConversion(inEty, outEty, unsafe)
		if elemConvs[i] == nil {
			// If a recursive conversion isn't available, then our top-level
			// configuration is impossible too.
			return nil
		}
	}

	// If we get here then a conversion is possible, using the element
	// conversions given in elemConvs.
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		elemVals := make([]cty.Value, len(elemConvs))
		path = append(path, nil)
		pathStep := &path[len(path)-1]

		i := 0
		for it := val.ElementIterator(); it.Next(); i++ {
			_, val := it.Element()
			var err error

			*pathStep = cty.IndexStep{
				Key: cty.NumberIntVal(int64(i)),
			}

			conv := elemConvs[i]
			if conv != nil {
				val, err = conv(val, path)
				if err != nil {
					return cty.NilVal, err
				}
			}

			elemVals[i] = val
		}

		return cty.TupleVal(elemVals), nil
	}
}
