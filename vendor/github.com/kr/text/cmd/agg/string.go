package main

import (
	"math/rand"
	"strings"
)

func first(s, arg string) agg  { return &sbinop{s, opfirst} }
func last(s, arg string) agg   { return &sbinop{s, oplast} }
func prefix(s, arg string) agg { return &sbinop{s, opprefix} }
func join(s, arg string) agg   { return &sbinop{s, opjoin(arg)} }
func smin(s, arg string) agg   { return &sbinop{s, opsmin} }
func smax(s, arg string) agg   { return &sbinop{s, opsmax} }

type sbinop struct {
	s string
	f func(a, b string) string
}

func (o *sbinop) String() string { return o.s }

func (o *sbinop) merge(s string) { o.s = o.f(o.s, s) }

func opfirst(a, b string) string { return a }
func oplast(a, b string) string  { return b }

func opprefix(a, b string) string {
	for i := range a {
		if i >= len(b) || a[i] != b[i] {
			return a[:i]
		}
	}
	return a
}

func opjoin(sep string) func(a, b string) string {
	return func(a, b string) string {
		return a + sep + b // TODO(kr): too slow? maybe strings.Join?
	}
}

func opsmin(a, b string) string {
	if strings.Compare(a, b) <= 0 {
		return a
	}
	return b
}

func opsmax(a, b string) string {
	if strings.Compare(a, b) >= 0 {
		return a
	}
	return b
}

type sampler struct {
	n int
	s string
}

func sample(s, arg string) agg    { return &sampler{1, s} }
func (p *sampler) String() string { return p.s }
func (p *sampler) merge(s string) {
	p.n++
	if rand.Intn(p.n) == 0 {
		p.s = s
	}
}

type constant string

func constf(init, arg string) agg { return constant(arg) }
func (c constant) String() string { return string(c) }
func (c constant) merge(string)   {}
