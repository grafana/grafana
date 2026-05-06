package stdlib

import (
	"bytes"
	"fmt"
	"math/big"
	"strings"

	"github.com/apparentlymart/go-textseg/v13/textseg"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
	"github.com/zclconf/go-cty/cty/function"
	"github.com/zclconf/go-cty/cty/json"
)

//go:generate ragel -Z format_fsm.rl
//go:generate gofmt -w format_fsm.go

var FormatFunc = function.New(&function.Spec{
	Description: `Constructs a string by applying formatting verbs to a series of arguments, using a similar syntax to the C function \"printf\".`,
	Params: []function.Parameter{
		{
			Name: "format",
			Type: cty.String,
		},
	},
	VarParam: &function.Parameter{
		Name:         "args",
		Type:         cty.DynamicPseudoType,
		AllowNull:    true,
		AllowUnknown: true,
	},
	Type:         function.StaticReturnType(cty.String),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		for _, arg := range args[1:] {
			if !arg.IsWhollyKnown() {
				// We require all nested values to be known because the only
				// thing we can do for a collection/structural type is print
				// it as JSON and that requires it to be wholly known.
				// However, we might be able to refine the result with a
				// known prefix, if there are literal characters before the
				// first formatting verb.
				f := args[0].AsString()
				if idx := strings.IndexByte(f, '%'); idx > 0 {
					prefix := f[:idx]
					return cty.UnknownVal(cty.String).Refine().StringPrefix(prefix).NewValue(), nil
				}
				return cty.UnknownVal(cty.String), nil
			}
		}
		str, err := formatFSM(args[0].AsString(), args[1:])
		return cty.StringVal(str), err
	},
})

var FormatListFunc = function.New(&function.Spec{
	Description: `Constructs a list of strings by applying formatting verbs to a series of arguments, using a similar syntax to the C function \"printf\".`,
	Params: []function.Parameter{
		{
			Name: "format",
			Type: cty.String,
		},
	},
	VarParam: &function.Parameter{
		Name:         "args",
		Type:         cty.DynamicPseudoType,
		AllowNull:    true,
		AllowUnknown: true,
	},
	Type:         function.StaticReturnType(cty.List(cty.String)),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		fmtVal := args[0]
		args = args[1:]

		if len(args) == 0 {
			// With no arguments, this function is equivalent to Format, but
			// returning a single-element list result.
			result, err := Format(fmtVal, args...)
			return cty.ListVal([]cty.Value{result}), err
		}

		fmtStr := fmtVal.AsString()

		// Each of our arguments will be dealt with either as an iterator
		// or as a single value. Iterators are used for sequence-type values
		// (lists, sets, tuples) while everything else is treated as a
		// single value. The sequences we iterate over are required to be
		// all the same length.
		iterLen := -1
		lenChooser := -1
		iterators := make([]cty.ElementIterator, len(args))
		singleVals := make([]cty.Value, len(args))
		unknowns := make([]bool, len(args))
		for i, arg := range args {
			argTy := arg.Type()
			switch {
			case (argTy.IsListType() || argTy.IsSetType() || argTy.IsTupleType()) && !arg.IsNull():
				if !argTy.IsTupleType() && !(arg.IsKnown() && arg.Length().IsKnown()) {
					// We can't iterate this one at all yet then, so we can't
					// yet produce a result.
					unknowns[i] = true
					continue
				}
				thisLen := arg.LengthInt()
				if iterLen == -1 {
					iterLen = thisLen
					lenChooser = i
				} else {
					if thisLen != iterLen {
						return cty.NullVal(cty.List(cty.String)), function.NewArgErrorf(
							i+1,
							"argument %d has length %d, which is inconsistent with argument %d of length %d",
							i+1, thisLen,
							lenChooser+1, iterLen,
						)
					}
				}
				if !arg.IsKnown() {
					// We allowed an unknown tuple value to fall through in
					// our initial check above so that we'd be able to run
					// the above error checks against it, but we still can't
					// iterate it if the checks pass.
					unknowns[i] = true
					continue
				}
				iterators[i] = arg.ElementIterator()
			case arg == cty.DynamicVal:
				unknowns[i] = true
			default:
				singleVals[i] = arg
			}
		}

		for _, isUnk := range unknowns {
			if isUnk {
				return cty.UnknownVal(retType), nil
			}
		}

		if iterLen == 0 {
			// If our sequences are all empty then our result must be empty.
			return cty.ListValEmpty(cty.String), nil
		}

		if iterLen == -1 {
			// If we didn't encounter any iterables at all then we're going
			// to just do one iteration with items from singleVals.
			iterLen = 1
		}

		ret := make([]cty.Value, 0, iterLen)
		fmtArgs := make([]cty.Value, len(iterators))
	Results:
		for iterIdx := 0; iterIdx < iterLen; iterIdx++ {

			// Construct our arguments for a single format call
			for i := range fmtArgs {
				switch {
				case iterators[i] != nil:
					iterator := iterators[i]
					iterator.Next()
					_, val := iterator.Element()
					fmtArgs[i] = val
				default:
					fmtArgs[i] = singleVals[i]
				}

				// If any of the arguments to this call would be unknown then
				// this particular result is unknown, but we'll keep going
				// to see if any other iterations can produce known values.
				if !fmtArgs[i].IsWhollyKnown() {
					// We require all nested values to be known because the only
					// thing we can do for a collection/structural type is print
					// it as JSON and that requires it to be wholly known.
					ret = append(ret, cty.UnknownVal(cty.String).RefineNotNull())
					continue Results
				}
			}

			str, err := formatFSM(fmtStr, fmtArgs)
			if err != nil {
				return cty.NullVal(cty.List(cty.String)), fmt.Errorf(
					"error on format iteration %d: %s", iterIdx, err,
				)
			}

			ret = append(ret, cty.StringVal(str))
		}

		return cty.ListVal(ret), nil
	},
})

// Format produces a string representation of zero or more values using a
// format string similar to the "printf" function in C.
//
// It supports the following "verbs":
//
//     %%      Literal percent sign, consuming no value
//     %v      A default formatting of the value based on type, as described below.
//     %#v     JSON serialization of the value
//     %t      Converts to boolean and then produces "true" or "false"
//     %b      Converts to number, requires integer, produces binary representation
//     %d      Converts to number, requires integer, produces decimal representation
//     %o      Converts to number, requires integer, produces octal representation
//     %x      Converts to number, requires integer, produces hexadecimal representation
//             with lowercase letters
//     %X      Like %x but with uppercase letters
//     %e      Converts to number, produces scientific notation like -1.234456e+78
//     %E      Like %e but with an uppercase "E" representing the exponent
//     %f      Converts to number, produces decimal representation with fractional
//             part but no exponent, like 123.456
//     %g      %e for large exponents or %f otherwise
//     %G      %E for large exponents or %f otherwise
//     %s      Converts to string and produces the string's characters
//     %q      Converts to string and produces JSON-quoted string representation,
//             like %v.
//
// The default format selections made by %v are:
//
//     string  %s
//     number  %g
//     bool    %t
//     other   %#v
//
// Null values produce the literal keyword "null" for %v and %#v, and produce
// an error otherwise.
//
// Width is specified by an optional decimal number immediately preceding the
// verb letter. If absent, the width is whatever is necessary to represent the
// value. Precision is specified after the (optional) width by a period
// followed by a decimal number. If no period is present, a default precision
// is used. A period with no following number is invalid.
// For examples:
//
//     %f     default width, default precision
//     %9f    width 9, default precision
//     %.2f   default width, precision 2
//     %9.2f  width 9, precision 2
//
// Width and precision are measured in unicode characters (grapheme clusters).
//
// For most values, width is the minimum number of characters to output,
// padding the formatted form with spaces if necessary.
//
// For strings, precision limits the length of the input to be formatted (not
// the size of the output), truncating if necessary.
//
// For numbers, width sets the minimum width of the field and precision sets
// the number of places after the decimal, if appropriate, except that for
// %g/%G precision sets the total number of significant digits.
//
// The following additional symbols can be used immediately after the percent
// introducer as flags:
//
//           (a space) leave a space where the sign would be if number is positive
//     +     Include a sign for a number even if it is positive (numeric only)
//     -     Pad with spaces on the left rather than the right
//     0     Pad with zeros rather than spaces.
//
// Flag characters are ignored for verbs that do not support them.
//
// By default, % sequences consume successive arguments starting with the first.
// Introducing a [n] sequence immediately before the verb letter, where n is a
// decimal integer, explicitly chooses a particular value argument by its
// one-based index. Subsequent calls without an explicit index will then
// proceed with n+1, n+2, etc.
//
// An error is produced if the format string calls for an impossible conversion
// or accesses more values than are given. An error is produced also for
// an unsupported format verb.
func Format(format cty.Value, vals ...cty.Value) (cty.Value, error) {
	args := make([]cty.Value, 0, len(vals)+1)
	args = append(args, format)
	args = append(args, vals...)
	return FormatFunc.Call(args)
}

// FormatList applies the same formatting behavior as Format, but accepts
// a mixture of list and non-list values as arguments. Any list arguments
// passed must have the same length, which dictates the length of the
// resulting list.
//
// Any non-list arguments are used repeatedly for each iteration over the
// list arguments. The list arguments are iterated in order by key, so
// corresponding items are formatted together.
func FormatList(format cty.Value, vals ...cty.Value) (cty.Value, error) {
	args := make([]cty.Value, 0, len(vals)+1)
	args = append(args, format)
	args = append(args, vals...)
	return FormatListFunc.Call(args)
}

type formatVerb struct {
	Raw    string
	Offset int

	ArgNum int
	Mode   rune

	Zero  bool
	Sharp bool
	Plus  bool
	Minus bool
	Space bool

	HasPrec bool
	Prec    int

	HasWidth bool
	Width    int
}

// formatAppend is called by formatFSM (generated by format_fsm.rl) for each
// formatting sequence that is encountered.
func formatAppend(verb *formatVerb, buf *bytes.Buffer, args []cty.Value) error {
	argIdx := verb.ArgNum - 1
	if argIdx >= len(args) {
		return fmt.Errorf(
			"not enough arguments for %q at %d: need index %d but have %d total",
			verb.Raw, verb.Offset,
			verb.ArgNum, len(args),
		)
	}
	arg := args[argIdx]

	if verb.Mode != 'v' && arg.IsNull() {
		return fmt.Errorf("unsupported value for %q at %d: null value cannot be formatted", verb.Raw, verb.Offset)
	}

	// Normalize to make some things easier for downstream formatters
	if !verb.HasWidth {
		verb.Width = -1
	}
	if !verb.HasPrec {
		verb.Prec = -1
	}

	// For our first pass we'll ensure the verb is supported and then fan
	// out to other functions based on what conversion is needed.
	switch verb.Mode {

	case 'v':
		return formatAppendAsIs(verb, buf, arg)

	case 't':
		return formatAppendBool(verb, buf, arg)

	case 'b', 'd', 'o', 'x', 'X', 'e', 'E', 'f', 'g', 'G':
		return formatAppendNumber(verb, buf, arg)

	case 's', 'q':
		return formatAppendString(verb, buf, arg)

	default:
		return fmt.Errorf("unsupported format verb %q in %q at offset %d", verb.Mode, verb.Raw, verb.Offset)
	}
}

func formatAppendAsIs(verb *formatVerb, buf *bytes.Buffer, arg cty.Value) error {

	if !verb.Sharp && !arg.IsNull() {
		// Unless the caller overrode it with the sharp flag, we'll try some
		// specialized formats before we fall back on JSON.
		switch arg.Type() {
		case cty.String:
			fmted := arg.AsString()
			fmted = formatPadWidth(verb, fmted)
			buf.WriteString(fmted)
			return nil
		case cty.Number:
			bf := arg.AsBigFloat()
			fmted := bf.Text('g', -1)
			fmted = formatPadWidth(verb, fmted)
			buf.WriteString(fmted)
			return nil
		}
	}

	jb, err := json.Marshal(arg, arg.Type())
	if err != nil {
		return fmt.Errorf("unsupported value for %q at %d: %s", verb.Raw, verb.Offset, err)
	}
	fmted := formatPadWidth(verb, string(jb))
	buf.WriteString(fmted)

	return nil
}

func formatAppendBool(verb *formatVerb, buf *bytes.Buffer, arg cty.Value) error {
	var err error
	arg, err = convert.Convert(arg, cty.Bool)
	if err != nil {
		return fmt.Errorf("unsupported value for %q at %d: %s", verb.Raw, verb.Offset, err)
	}

	if arg.True() {
		buf.WriteString("true")
	} else {
		buf.WriteString("false")
	}
	return nil
}

func formatAppendNumber(verb *formatVerb, buf *bytes.Buffer, arg cty.Value) error {
	var err error
	arg, err = convert.Convert(arg, cty.Number)
	if err != nil {
		return fmt.Errorf("unsupported value for %q at %d: %s", verb.Raw, verb.Offset, err)
	}

	switch verb.Mode {
	case 'b', 'd', 'o', 'x', 'X':
		return formatAppendInteger(verb, buf, arg)
	default:
		bf := arg.AsBigFloat()

		// For floats our format syntax is a subset of Go's, so it's
		// safe for us to just lean on the existing Go implementation.
		fmtstr := formatStripIndexSegment(verb.Raw)
		fmted := fmt.Sprintf(fmtstr, bf)
		buf.WriteString(fmted)
		return nil
	}
}

func formatAppendInteger(verb *formatVerb, buf *bytes.Buffer, arg cty.Value) error {
	bf := arg.AsBigFloat()
	bi, acc := bf.Int(nil)
	if acc != big.Exact {
		return fmt.Errorf("unsupported value for %q at %d: an integer is required", verb.Raw, verb.Offset)
	}

	// For integers our format syntax is a subset of Go's, so it's
	// safe for us to just lean on the existing Go implementation.
	fmtstr := formatStripIndexSegment(verb.Raw)
	fmted := fmt.Sprintf(fmtstr, bi)
	buf.WriteString(fmted)
	return nil
}

func formatAppendString(verb *formatVerb, buf *bytes.Buffer, arg cty.Value) error {
	var err error
	arg, err = convert.Convert(arg, cty.String)
	if err != nil {
		return fmt.Errorf("unsupported value for %q at %d: %s", verb.Raw, verb.Offset, err)
	}

	// We _cannot_ directly use the Go fmt.Sprintf implementation for strings
	// because it measures widths and precisions in runes rather than grapheme
	// clusters.

	str := arg.AsString()
	if verb.Prec > 0 {
		strB := []byte(str)
		pos := 0
		wanted := verb.Prec
		for i := 0; i < wanted; i++ {
			next := strB[pos:]
			if len(next) == 0 {
				// ran out of characters before we hit our max width
				break
			}
			d, _, _ := textseg.ScanGraphemeClusters(strB[pos:], true)
			pos += d
		}
		str = str[:pos]
	}

	switch verb.Mode {
	case 's':
		fmted := formatPadWidth(verb, str)
		buf.WriteString(fmted)
	case 'q':
		jb, err := json.Marshal(cty.StringVal(str), cty.String)
		if err != nil {
			// Should never happen, since we know this is a known, non-null string
			panic(fmt.Errorf("failed to marshal %#v as JSON: %s", arg, err))
		}
		fmted := formatPadWidth(verb, string(jb))
		buf.WriteString(fmted)
	default:
		// Should never happen because formatAppend should've already validated
		panic(fmt.Errorf("invalid string formatting mode %q", verb.Mode))
	}
	return nil
}

func formatPadWidth(verb *formatVerb, fmted string) string {
	if verb.Width < 0 {
		return fmted
	}

	// Safe to ignore errors because ScanGraphemeClusters cannot produce errors
	givenLen, _ := textseg.TokenCount([]byte(fmted), textseg.ScanGraphemeClusters)
	wantLen := verb.Width
	if givenLen >= wantLen {
		return fmted
	}

	padLen := wantLen - givenLen
	padChar := " "
	if verb.Zero {
		padChar = "0"
	}
	pads := strings.Repeat(padChar, padLen)

	if verb.Minus {
		return fmted + pads
	}
	return pads + fmted
}

// formatStripIndexSegment strips out any [nnn] segment present in a verb
// string so that we can pass it through to Go's fmt.Sprintf with a single
// argument. This is used in cases where we're just leaning on Go's formatter
// because it's a superset of ours.
func formatStripIndexSegment(rawVerb string) string {
	// We assume the string has already been validated here, since we should
	// only be using this function with strings that were accepted by our
	// scanner in formatFSM.
	start := strings.Index(rawVerb, "[")
	end := strings.Index(rawVerb, "]")
	if start == -1 || end == -1 {
		return rawVerb
	}

	return rawVerb[:start] + rawVerb[end+1:]
}
