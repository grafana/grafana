package stdlib

import (
	"fmt"
	"reflect"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
	"github.com/zclconf/go-cty/cty/gocty"
)

// Bytes is a capsule type that can be used with the binary functions to
// support applications that need to support raw buffers in addition to
// UTF-8 strings.
var Bytes = cty.Capsule("bytes", reflect.TypeOf([]byte(nil)))

// BytesVal creates a new Bytes value from the given buffer, which must be
// non-nil or this function will panic.
//
// Once a byte slice has been wrapped in a Bytes capsule, its underlying array
// must be considered immutable.
func BytesVal(buf []byte) cty.Value {
	if buf == nil {
		panic("can't make Bytes value from nil slice")
	}

	return cty.CapsuleVal(Bytes, &buf)
}

// BytesLen is a Function that returns the length of the buffer encapsulated
// in a Bytes value.
var BytesLenFunc = function.New(&function.Spec{
	Description: `Returns the total number of bytes in the given buffer.`,
	Params: []function.Parameter{
		{
			Name:             "buf",
			Type:             Bytes,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		bufPtr := args[0].EncapsulatedValue().(*[]byte)
		return cty.NumberIntVal(int64(len(*bufPtr))), nil
	},
})

// BytesSlice is a Function that returns a slice of the given Bytes value.
var BytesSliceFunc = function.New(&function.Spec{
	Description: `Extracts a subslice from the given buffer.`,
	Params: []function.Parameter{
		{
			Name:             "buf",
			Type:             Bytes,
			AllowDynamicType: true,
		},
		{
			Name:             "offset",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
		{
			Name:             "length",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(Bytes),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		bufPtr := args[0].EncapsulatedValue().(*[]byte)

		var offset, length int

		var err error
		err = gocty.FromCtyValue(args[1], &offset)
		if err != nil {
			return cty.NilVal, err
		}
		err = gocty.FromCtyValue(args[2], &length)
		if err != nil {
			return cty.NilVal, err
		}

		if offset < 0 || length < 0 {
			return cty.NilVal, fmt.Errorf("offset and length must be non-negative")
		}

		if offset > len(*bufPtr) {
			return cty.NilVal, fmt.Errorf(
				"offset %d is greater than total buffer length %d",
				offset, len(*bufPtr),
			)
		}

		end := offset + length

		if end > len(*bufPtr) {
			return cty.NilVal, fmt.Errorf(
				"offset %d + length %d is greater than total buffer length %d",
				offset, length, len(*bufPtr),
			)
		}

		return BytesVal((*bufPtr)[offset:end]), nil
	},
})

func BytesLen(buf cty.Value) (cty.Value, error) {
	return BytesLenFunc.Call([]cty.Value{buf})
}

func BytesSlice(buf cty.Value, offset cty.Value, length cty.Value) (cty.Value, error) {
	return BytesSliceFunc.Call([]cty.Value{buf, offset, length})
}
