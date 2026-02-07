package cty

import (
	"math/big"
)

// primitiveType is the hidden implementation of the various primitive types
// that are exposed as variables in this package.
type primitiveType struct {
	typeImplSigil
	Kind primitiveTypeKind
}

type primitiveTypeKind byte

const (
	primitiveTypeBool   primitiveTypeKind = 'B'
	primitiveTypeNumber primitiveTypeKind = 'N'
	primitiveTypeString primitiveTypeKind = 'S'
)

func (t primitiveType) Equals(other Type) bool {
	if otherP, ok := other.typeImpl.(primitiveType); ok {
		return otherP.Kind == t.Kind
	}
	return false
}

func (t primitiveType) FriendlyName(mode friendlyTypeNameMode) string {
	switch t.Kind {
	case primitiveTypeBool:
		return "bool"
	case primitiveTypeNumber:
		return "number"
	case primitiveTypeString:
		return "string"
	default:
		// should never happen
		panic("invalid primitive type")
	}
}

func (t primitiveType) GoString() string {
	switch t.Kind {
	case primitiveTypeBool:
		return "cty.Bool"
	case primitiveTypeNumber:
		return "cty.Number"
	case primitiveTypeString:
		return "cty.String"
	default:
		// should never happen
		panic("invalid primitive type")
	}
}

// rawNumberEqual is our cty-specific definition of whether two big floats
// underlying cty.Number are "equal" for the purposes of the Value.Equals and
// Value.RawEquals methods.
//
// The built-in equality for big.Float is a direct comparison of the mantissa
// bits and the exponent, but that's too precise a check for cty because we
// routinely send numbers through decimal approximations and back and so
// we only promise to accurately represent the subset of binary floating point
// numbers that can be derived from a decimal string representation.
//
// In respect of the fact that cty only tries to preserve numbers that can
// reasonably be written in JSON documents, we use the string representation of
// a decimal approximation of the number as our comparison, relying on the
// big.Float type's heuristic for discarding extraneous mantissa bits that seem
// likely to only be there as a result of an earlier decimal-to-binary
// approximation during parsing, e.g. in ParseNumberVal.
func rawNumberEqual(a, b *big.Float) bool {
	switch {
	case (a == nil) != (b == nil):
		return false
	case a == nil: // b == nil too then, due to previous case
		return true
	case a.Sign() != b.Sign():
		return false
	default:
		// First check if these are integers, and compare them directly. Floats
		// need a more nuanced approach.
		aInt, aAcc := a.Int(nil)
		bInt, bAcc := b.Int(nil)
		if aAcc != bAcc {
			// only one is an exact integer value, so they can't be equal
			return false
		}
		if aAcc == big.Exact {
			return aInt.Cmp(bInt) == 0
		}

		// This format and precision matches that used by cty/json.Marshal,
		// and thus achieves our definition of "two numbers are equal if
		// we'd use the same JSON serialization for both of them".
		const format = 'f'
		const prec = -1
		aStr := a.Text(format, prec)
		bStr := b.Text(format, prec)

		// The one exception to our rule about equality-by-stringification is
		// negative zero, because we want -0 to always be equal to +0.
		const posZero = "0"
		const negZero = "-0"
		if aStr == negZero {
			aStr = posZero
		}
		if bStr == negZero {
			bStr = posZero
		}
		return aStr == bStr
	}
}

// Number is the numeric type. Number values are arbitrary-precision
// decimal numbers, which can then be converted into Go's various numeric
// types only if they are in the appropriate range.
var Number Type

// String is the string type. String values are sequences of unicode codepoints
// encoded internally as UTF-8.
var String Type

// Bool is the boolean type. The two values of this type are True and False.
var Bool Type

// True is the truthy value of type Bool
var True Value

// False is the falsey value of type Bool
var False Value

// Zero is a number value representing exactly zero.
var Zero Value

// PositiveInfinity is a Number value representing positive infinity
var PositiveInfinity Value

// NegativeInfinity is a Number value representing negative infinity
var NegativeInfinity Value

func init() {
	Number = Type{
		primitiveType{Kind: primitiveTypeNumber},
	}
	String = Type{
		primitiveType{Kind: primitiveTypeString},
	}
	Bool = Type{
		primitiveType{Kind: primitiveTypeBool},
	}
	True = Value{
		ty: Bool,
		v:  true,
	}
	False = Value{
		ty: Bool,
		v:  false,
	}
	Zero = Value{
		ty: Number,
		v:  big.NewFloat(0),
	}
	PositiveInfinity = Value{
		ty: Number,
		v:  (&big.Float{}).SetInf(false),
	}
	NegativeInfinity = Value{
		ty: Number,
		v:  (&big.Float{}).SetInf(true),
	}
}

// IsPrimitiveType returns true if and only if the reciever is a primitive
// type, which means it's either number, string, or bool. Any two primitive
// types can be safely compared for equality using the standard == operator
// without panic, which is not a guarantee that holds for all types. Primitive
// types can therefore also be used in switch statements.
func (t Type) IsPrimitiveType() bool {
	_, ok := t.typeImpl.(primitiveType)
	return ok
}
