// Copyright 2016 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

package apd

// MakeErrDecimal creates a ErrDecimal with given context.
func MakeErrDecimal(c *Context) ErrDecimal {
	return ErrDecimal{
		Ctx: c,
	}
}

// ErrDecimal performs operations on decimals and collects errors during
// operations. If an error is already set, the operation is skipped. Designed to
// be used for many operations in a row, with a single error check at the end.
type ErrDecimal struct {
	err error
	Ctx *Context
	// Flags are the accumulated flags from operations.
	Flags Condition
}

// Err returns the first error encountered or the context's trap error
// if present.
func (e *ErrDecimal) Err() error {
	if e.err != nil {
		return e.err
	}
	if e.Ctx != nil {
		_, e.err = e.Ctx.goError(e.Flags)
		return e.err
	}
	return nil
}

func (e *ErrDecimal) op2(d, x *Decimal, f func(a, b *Decimal) (Condition, error)) *Decimal {
	if e.Err() != nil {
		return d
	}
	res, err := f(d, x)
	e.Flags |= res
	e.err = err
	return d
}

func (e *ErrDecimal) op3(d, x, y *Decimal, f func(a, b, c *Decimal) (Condition, error)) *Decimal {
	if e.Err() != nil {
		return d
	}
	res, err := f(d, x, y)
	e.Flags |= res
	e.err = err
	return d
}

// Abs performs e.Ctx.Abs(d, x) and returns d.
func (e *ErrDecimal) Abs(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Abs)
}

// Add performs e.Ctx.Add(d, x, y) and returns d.
func (e *ErrDecimal) Add(d, x, y *Decimal) *Decimal {
	return e.op3(d, x, y, e.Ctx.Add)
}

// Ceil performs e.Ctx.Ceil(d, x) and returns d.
func (e *ErrDecimal) Ceil(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Ceil)
}

// Exp performs e.Ctx.Exp(d, x) and returns d.
func (e *ErrDecimal) Exp(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Exp)
}

// Floor performs e.Ctx.Floor(d, x) and returns d.
func (e *ErrDecimal) Floor(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Floor)
}

// Int64 returns 0 if err is set. Otherwise returns d.Int64().
func (e *ErrDecimal) Int64(d *Decimal) int64 {
	if e.Err() != nil {
		return 0
	}
	var r int64
	r, e.err = d.Int64()
	return r
}

// Ln performs e.Ctx.Ln(d, x) and returns d.
func (e *ErrDecimal) Ln(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Ln)
}

// Log10 performs d.Log10(x) and returns d.
func (e *ErrDecimal) Log10(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Log10)
}

// Mul performs e.Ctx.Mul(d, x, y) and returns d.
func (e *ErrDecimal) Mul(d, x, y *Decimal) *Decimal {
	return e.op3(d, x, y, e.Ctx.Mul)
}

// Neg performs e.Ctx.Neg(d, x) and returns d.
func (e *ErrDecimal) Neg(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Neg)
}

// Pow performs e.Ctx.Pow(d, x, y) and returns d.
func (e *ErrDecimal) Pow(d, x, y *Decimal) *Decimal {
	return e.op3(d, x, y, e.Ctx.Pow)
}

// Quantize performs e.Ctx.Quantize(d, v, exp) and returns d.
func (e *ErrDecimal) Quantize(d, v *Decimal, exp int32) *Decimal {
	if e.Err() != nil {
		return d
	}
	res, err := e.Ctx.Quantize(d, v, exp)
	e.Flags |= res
	e.err = err
	return d
}

// Quo performs e.Ctx.Quo(d, x, y) and returns d.
func (e *ErrDecimal) Quo(d, x, y *Decimal) *Decimal {
	return e.op3(d, x, y, e.Ctx.Quo)
}

// QuoInteger performs e.Ctx.QuoInteger(d, x, y) and returns d.
func (e *ErrDecimal) QuoInteger(d, x, y *Decimal) *Decimal {
	return e.op3(d, x, y, e.Ctx.QuoInteger)
}

// Reduce performs e.Ctx.Reduce(d, x) and returns the number of zeros removed
// and d.
func (e *ErrDecimal) Reduce(d, x *Decimal) (int, *Decimal) {
	if e.Err() != nil {
		return 0, d
	}
	n, res, err := e.Ctx.Reduce(d, x)
	e.Flags |= res
	e.err = err
	return n, d
}

// Rem performs e.Ctx.Rem(d, x, y) and returns d.
func (e *ErrDecimal) Rem(d, x, y *Decimal) *Decimal {
	return e.op3(d, x, y, e.Ctx.Rem)
}

// Round performs e.Ctx.Round(d, x) and returns d.
func (e *ErrDecimal) Round(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Round)
}

// Sqrt performs e.Ctx.Sqrt(d, x) and returns d.
func (e *ErrDecimal) Sqrt(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.Sqrt)
}

// Sub performs e.Ctx.Sub(d, x, y) and returns d.
func (e *ErrDecimal) Sub(d, x, y *Decimal) *Decimal {
	return e.op3(d, x, y, e.Ctx.Sub)
}

// RoundToIntegralValue performs e.Ctx.RoundToIntegralValue(d, x) and returns d.
func (e *ErrDecimal) RoundToIntegralValue(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.RoundToIntegralValue)
}

// RoundToIntegralExact performs e.Ctx.RoundToIntegralExact(d, x) and returns d.
func (e *ErrDecimal) RoundToIntegralExact(d, x *Decimal) *Decimal {
	return e.op2(d, x, e.Ctx.RoundToIntegralExact)
}
