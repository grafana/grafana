package main

import (
	"math/big"
	"strconv"
)

func min(s, arg string) agg { return newBinop(s, opmin) }
func max(s, arg string) agg { return newBinop(s, opmax) }
func sum(s, arg string) agg { return newBinop(s, opsum) }

type binop struct {
	v *big.Float
	f func(a, b *big.Float) *big.Float
}

func newBinop(s string, f func(a, b *big.Float) *big.Float) *binop {
	v, _ := parseFloat(s)
	return &binop{v, f}
}

func (o *binop) String() string {
	if o.v == nil {
		return "NaN"
	}
	return o.v.Text('f', -1)
}

func (o *binop) merge(s string) {
	v, ok := parseFloat(s)
	if !ok {
		return
	}
	o.v = o.f(o.v, v)
}

func opmin(a, b *big.Float) *big.Float {
	if a != nil && (b == nil || a.Cmp(b) <= 0) {
		return a
	}
	return b
}

func opmax(a, b *big.Float) *big.Float {
	if a != nil && (b == nil || a.Cmp(b) >= 0) {
		return a
	}
	return b
}

func opsum(a, b *big.Float) *big.Float {
	if a == nil {
		return b
	} else if b == nil {
		return a
	}
	return a.Add(a, b)
}

type meanagg struct {
	v *big.Float
	d float64 // actually an integer
}

func mean(s, arg string) agg {
	v, ok := parseFloat(s)
	if !ok {
		return &meanagg{new(big.Float), 0}
	}
	return &meanagg{v, 1}
}

func (m *meanagg) String() string {
	if m.d == 0 {
		return "NaN"
	}
	v := new(big.Float).Quo(m.v, big.NewFloat(m.d))
	return v.Text('f', -1)
}

func (m *meanagg) merge(s string) {
	v, ok := parseFloat(s)
	if !ok {
		return
	}
	m.v.Add(m.v, v)
	m.d++
}

func parseFloat(s string) (*big.Float, bool) {
	v, _, err := big.ParseFloat(s, 0, 1000, big.ToNearestEven)
	return v, err == nil
}

type counter int

func count(init, arg string) agg  { return new(counter) }
func (c *counter) String() string { return strconv.Itoa(int(*c) + 1) }
func (c *counter) merge(string)   { *c++ }
