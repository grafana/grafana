// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"fmt"
	"reflect"
	"sync"
)

type generatorImpl[V any] interface {
	String() string
	value(t *T) V
}

// Generator describes a generator of values of type V.
type Generator[V any] struct {
	impl    generatorImpl[V]
	strOnce sync.Once
	str     string
}

func newGenerator[V any](impl generatorImpl[V]) *Generator[V] {
	return &Generator[V]{
		impl: impl,
	}
}

func (g *Generator[V]) String() string {
	g.strOnce.Do(func() {
		g.str = g.impl.String()
	})

	return g.str
}

// Draw produces a value from the generator.
func (g *Generator[V]) Draw(t *T, label string) V {
	if t.tbLog {
		t.tb.Helper()
	}

	v := g.value(t)

	if len(t.refDraws) > 0 {
		ref := t.refDraws[t.draws]
		if !reflect.DeepEqual(v, ref) {
			t.tb.Fatalf("draw %v differs: %#v vs expected %#v", t.draws, v, ref)
		}
	}

	if t.tbLog || t.rawLog != nil {
		if label == "" {
			label = fmt.Sprintf("#%v", t.draws)
		}

		if t.tbLog {
			t.tb.Helper()
		}
		t.Logf("[rapid] draw %v: %#v", label, v)
	}

	t.draws++

	return v
}

func (g *Generator[V]) value(t *T) V {
	i := t.s.beginGroup(g.str, true)
	v := g.impl.value(t)
	t.s.endGroup(i, false)
	return v
}

// Example produces an example value from the generator. If seed is provided, value is produced deterministically
// based on seed. Example should only be used for examples; always use *Generator.Draw in property-based tests.
func (g *Generator[V]) Example(seed ...int) V {
	s := baseSeed()
	if len(seed) > 0 {
		s = uint64(seed[0])
	}

	v, n, err := example(g, newT(nil, newRandomBitStream(s, false), false, nil))
	assertf(err == nil, "%v failed to generate an example in %v tries: %v", g, n, err)

	return v
}

// Filter creates a generator producing only values from g for which fn returns true.
func (g *Generator[V]) Filter(fn func(V) bool) *Generator[V] {
	return filter(g, fn)
}

// AsAny creates a generator producing values from g converted to any.
func (g *Generator[V]) AsAny() *Generator[any] {
	return asAny(g)
}

func example[V any](g *Generator[V], t *T) (V, int, error) {
	defer t.cleanup()

	for i := 1; ; i++ {
		r, err := recoverValue(g, t)
		if err == nil {
			return r, i, nil
		} else if i == exampleMaxTries {
			var zero V
			return zero, i, err
		}
	}
}

func recoverValue[V any](g *Generator[V], t *T) (v V, err *testError) {
	defer func() { err = panicToError(recover(), 3) }()

	return g.value(t), nil
}
