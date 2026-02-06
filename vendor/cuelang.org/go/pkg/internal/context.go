// Copyright 2020 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package internal

import (
	"io"
	"math/big"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/value"
	"github.com/cockroachdb/apd/v2"
)

// CallCtxt is passed to builtin implementations that need to use a cue.Value. This is an internal type. Its interface may change.
type CallCtxt struct {
	ctx     *adt.OpContext
	builtin *Builtin
	Err     interface{}
	Ret     interface{}

	args []adt.Value
}

func (c *CallCtxt) Pos() token.Pos {
	return c.ctx.Pos()
}

func (c *CallCtxt) Name() string {
	return c.builtin.name(c.ctx)
}

// Do returns whether the call should be done.
func (c *CallCtxt) Do() bool {
	return c.Err == nil
}

func (c *CallCtxt) Value(i int) cue.Value {
	v := value.Make(c.ctx, c.args[i])
	// TODO: remove default
	// v, _ = v.Default()
	if !v.IsConcrete() {
		c.errcf(adt.IncompleteError, "non-concrete argument %d", i)
	}
	return v
}

func (c *CallCtxt) Struct(i int) Struct {
	x := c.args[i]
	switch v, ok := x.(*adt.Vertex); {
	case ok && !v.IsList():
		c.ctx.Unify(v, adt.Conjuncts)
		return Struct{c.ctx, v}

	case v != nil:
		x = v.Value()
	}
	if x.Kind()&adt.StructKind == 0 {
		var err error
		if b, ok := x.(*adt.Bottom); ok {
			err = &callError{b}
		}
		c.invalidArgType(c.args[i], i, "struct", err)
	} else {
		err := c.ctx.NewErrf("non-concrete struct for argument %d", i)
		err.Code = adt.IncompleteError
		c.Err = &callError{err}
	}
	return Struct{}
}

func (c *CallCtxt) Int(i int) int     { return int(c.intValue(i, 64, "int64")) }
func (c *CallCtxt) Int8(i int) int8   { return int8(c.intValue(i, 8, "int8")) }
func (c *CallCtxt) Int16(i int) int16 { return int16(c.intValue(i, 16, "int16")) }
func (c *CallCtxt) Int32(i int) int32 { return int32(c.intValue(i, 32, "int32")) }
func (c *CallCtxt) Rune(i int) rune   { return rune(c.intValue(i, 32, "rune")) }
func (c *CallCtxt) Int64(i int) int64 { return int64(c.intValue(i, 64, "int64")) }

func (c *CallCtxt) intValue(i, bits int, typ string) int64 {
	arg := c.args[i]
	x := value.Make(c.ctx, arg)
	n, err := x.Int(nil)
	if err != nil {
		c.invalidArgType(arg, i, typ, err)
		return 0
	}
	if n.BitLen() > bits {
		c.errf(err, "int %s overflows %s in argument %d in call to %s",
			n, typ, i, c.Name())
	}
	res, _ := x.Int64()
	return res
}

func (c *CallCtxt) Uint(i int) uint     { return uint(c.uintValue(i, 64, "uint64")) }
func (c *CallCtxt) Uint8(i int) uint8   { return uint8(c.uintValue(i, 8, "uint8")) }
func (c *CallCtxt) Byte(i int) uint8    { return byte(c.uintValue(i, 8, "byte")) }
func (c *CallCtxt) Uint16(i int) uint16 { return uint16(c.uintValue(i, 16, "uint16")) }
func (c *CallCtxt) Uint32(i int) uint32 { return uint32(c.uintValue(i, 32, "uint32")) }
func (c *CallCtxt) Uint64(i int) uint64 { return uint64(c.uintValue(i, 64, "uint64")) }

func (c *CallCtxt) uintValue(i, bits int, typ string) uint64 {
	x := value.Make(c.ctx, c.args[i])
	n, err := x.Int(nil)
	if err != nil || n.Sign() < 0 {
		c.invalidArgType(c.args[i], i, typ, err)
		return 0
	}
	if n.BitLen() > bits {
		c.errf(err, "int %s overflows %s in argument %d in call to %s",
			n, typ, i, c.Name())
	}
	res, _ := x.Uint64()
	return res
}

func (c *CallCtxt) Decimal(i int) *apd.Decimal {
	x := value.Make(c.ctx, c.args[i])
	if _, err := x.MantExp(nil); err != nil {
		c.invalidArgType(c.args[i], i, "Decimal", err)
		return nil
	}
	return &c.args[i].(*adt.Num).X
}

func (c *CallCtxt) Float64(i int) float64 {
	x := value.Make(c.ctx, c.args[i])
	res, err := x.Float64()
	if err != nil {
		c.invalidArgType(c.args[i], i, "float64", err)
		return 0
	}
	return res
}

func (c *CallCtxt) BigInt(i int) *big.Int {
	x := value.Make(c.ctx, c.args[i])
	n, err := x.Int(nil)
	if err != nil {
		c.invalidArgType(c.args[i], i, "int", err)
		return nil
	}
	return n
}

var ten = big.NewInt(10)

func (c *CallCtxt) BigFloat(i int) *big.Float {
	x := value.Make(c.ctx, c.args[i])
	var mant big.Int
	exp, err := x.MantExp(&mant)
	if err != nil {
		c.invalidArgType(c.args[i], i, "float", err)
		return nil
	}
	f := &big.Float{}
	f.SetInt(&mant)
	if exp != 0 {
		var g big.Float
		e := big.NewInt(int64(exp))
		f.Mul(f, g.SetInt(e.Exp(ten, e, nil)))
	}
	return f
}

func (c *CallCtxt) String(i int) string {
	// TODO: use Evaluate instead.
	x := value.Make(c.ctx, c.args[i])
	v, err := x.String()
	if err != nil {
		c.invalidArgType(c.args[i], i, "string", err)
		return ""
	}
	return v
}

func (c *CallCtxt) Bytes(i int) []byte {
	x := value.Make(c.ctx, c.args[i])
	v, err := x.Bytes()
	if err != nil {
		c.invalidArgType(c.args[i], i, "bytes", err)
		return nil
	}
	return v
}

func (c *CallCtxt) Reader(i int) io.Reader {
	x := value.Make(c.ctx, c.args[i])
	// TODO: optimize for string and bytes cases
	r, err := x.Reader()
	if err != nil {
		c.invalidArgType(c.args[i], i, "bytes|string", err)
		return nil
	}
	return r
}

func (c *CallCtxt) Bool(i int) bool {
	x := value.Make(c.ctx, c.args[i])
	b, err := x.Bool()
	if err != nil {
		c.invalidArgType(c.args[i], i, "bool", err)
		return false
	}
	return b
}

func (c *CallCtxt) List(i int) (a []cue.Value) {
	arg := c.args[i]
	x := value.Make(c.ctx, arg)
	v, err := x.List()
	if err != nil {
		c.invalidArgType(c.args[i], i, "list", err)
		return a
	}
	for v.Next() {
		a = append(a, v.Value())
	}
	return a
}

func (c *CallCtxt) CueList(i int) List {
	v := c.getList(i)
	if v == nil {
		return List{}
	}
	return List{c.ctx, v, v.BaseValue.(*adt.ListMarker).IsOpen}
}

func (c *CallCtxt) Iter(i int) (a cue.Iterator) {
	arg := c.args[i]
	x := value.Make(c.ctx, arg)
	v, err := x.List()
	if err != nil {
		c.invalidArgType(c.args[i], i, "list", err)
	}
	return v
}

func (c *CallCtxt) getList(i int) *adt.Vertex {
	x := c.args[i]
	switch v, ok := x.(*adt.Vertex); {
	case ok && v.IsList():
		v.Finalize(c.ctx)
		return v

	case v != nil:
		x = v.Value()
	}
	if x.Kind()&adt.ListKind == 0 {
		var err error
		if b, ok := x.(*adt.Bottom); ok {
			err = &callError{b}
		}
		c.invalidArgType(c.args[i], i, "list", err)
	} else {
		err := c.ctx.NewErrf("non-concrete list for argument %d", i)
		err.Code = adt.IncompleteError
		c.Err = &callError{err}
	}
	return nil
}

func (c *CallCtxt) DecimalList(i int) (a []*apd.Decimal) {
	v := c.getList(i)
	if v == nil {
		return nil
	}

	for j, w := range v.Elems() {
		w.Finalize(c.ctx) // defensive
		switch x := adt.Unwrap(adt.Default(w.Value())).(type) {
		case *adt.Num:
			a = append(a, &x.X)

		case *adt.Bottom:
			if x.IsIncomplete() {
				c.Err = x
				return nil
			}

		default:
			if k := w.Kind(); k&adt.NumKind == 0 {
				err := c.ctx.NewErrf(
					"invalid list element %d in argument %d to call: cannot use value %s (%s) as number",
					j, i, w, k)
				c.Err = &callError{err}
				return a
			}

			err := c.ctx.NewErrf(
				"non-concrete value %s for element %d of number list argument %d",
				w, j, i)
			err.Code = adt.IncompleteError
			c.Err = &callError{err}
			return nil
		}
	}
	return a
}

func (c *CallCtxt) StringList(i int) (a []string) {
	v := c.getList(i)
	if v == nil {
		return nil
	}

	for j, w := range v.Elems() {
		w.Finalize(c.ctx) // defensive
		switch x := adt.Unwrap(adt.Default(w.Value())).(type) {
		case *adt.String:
			a = append(a, x.Str)

		case *adt.Bottom:
			if x.IsIncomplete() {
				c.Err = x
				return nil
			}

		default:
			if k := w.Kind(); k&adt.StringKind == 0 {
				err := c.ctx.NewErrf(
					"invalid list element %d in argument %d to call: cannot use value %s (%s) as string",
					j, i, w, k)
				c.Err = &callError{err}
				return a
			}

			err := c.ctx.NewErrf(
				"non-concrete value %s for element %d of string list argument %d",
				w, j, i)
			err.Code = adt.IncompleteError
			c.Err = &callError{err}
			return nil
		}
	}
	return a
}
