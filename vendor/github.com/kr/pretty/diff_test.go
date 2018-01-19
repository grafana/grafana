package pretty

import (
	"bytes"
	"fmt"
	"log"
	"reflect"
	"testing"
	"unsafe"
)

var (
	_ Logfer   = (*testing.T)(nil)
	_ Logfer   = (*testing.B)(nil)
	_ Printfer = (*log.Logger)(nil)
)

type difftest struct {
	a   interface{}
	b   interface{}
	exp []string
}

type S struct {
	A int
	S *S
	I interface{}
	C []int
}

type (
	N struct{ N int }
	E interface{}
)

var (
	c0 = make(chan int)
	c1 = make(chan int)
	f0 = func() {}
	f1 = func() {}
	i0 = 0
	i1 = 1
)

var diffs = []difftest{
	{a: nil, b: nil},
	{a: S{A: 1}, b: S{A: 1}},

	{0, "", []string{`int != string`}},
	{0, 1, []string{`0 != 1`}},
	{S{}, new(S), []string{`pretty.S != *pretty.S`}},
	{"a", "b", []string{`"a" != "b"`}},
	{S{}, S{A: 1}, []string{`A: 0 != 1`}},
	{new(S), &S{A: 1}, []string{`A: 0 != 1`}},
	{S{S: new(S)}, S{S: &S{A: 1}}, []string{`S.A: 0 != 1`}},
	{S{}, S{I: 0}, []string{`I: nil != int(0)`}},
	{S{I: 1}, S{I: "x"}, []string{`I: int != string`}},
	{S{}, S{C: []int{1}}, []string{`C: []int[0] != []int[1]`}},
	{S{C: []int{}}, S{C: []int{1}}, []string{`C: []int[0] != []int[1]`}},
	{S{C: []int{1, 2, 3}}, S{C: []int{1, 2, 4}}, []string{`C[2]: 3 != 4`}},
	{S{}, S{A: 1, S: new(S)}, []string{`A: 0 != 1`, `S: nil != &pretty.S{}`}},

	// unexported fields of every reflect.Kind (both equal and unequal)
	{struct{ x bool }{false}, struct{ x bool }{false}, nil},
	{struct{ x bool }{false}, struct{ x bool }{true}, []string{`x: false != true`}},
	{struct{ x int }{0}, struct{ x int }{0}, nil},
	{struct{ x int }{0}, struct{ x int }{1}, []string{`x: 0 != 1`}},
	{struct{ x int8 }{0}, struct{ x int8 }{0}, nil},
	{struct{ x int8 }{0}, struct{ x int8 }{1}, []string{`x: 0 != 1`}},
	{struct{ x int16 }{0}, struct{ x int16 }{0}, nil},
	{struct{ x int16 }{0}, struct{ x int16 }{1}, []string{`x: 0 != 1`}},
	{struct{ x int32 }{0}, struct{ x int32 }{0}, nil},
	{struct{ x int32 }{0}, struct{ x int32 }{1}, []string{`x: 0 != 1`}},
	{struct{ x int64 }{0}, struct{ x int64 }{0}, nil},
	{struct{ x int64 }{0}, struct{ x int64 }{1}, []string{`x: 0 != 1`}},
	{struct{ x uint }{0}, struct{ x uint }{0}, nil},
	{struct{ x uint }{0}, struct{ x uint }{1}, []string{`x: 0 != 1`}},
	{struct{ x uint8 }{0}, struct{ x uint8 }{0}, nil},
	{struct{ x uint8 }{0}, struct{ x uint8 }{1}, []string{`x: 0 != 1`}},
	{struct{ x uint16 }{0}, struct{ x uint16 }{0}, nil},
	{struct{ x uint16 }{0}, struct{ x uint16 }{1}, []string{`x: 0 != 1`}},
	{struct{ x uint32 }{0}, struct{ x uint32 }{0}, nil},
	{struct{ x uint32 }{0}, struct{ x uint32 }{1}, []string{`x: 0 != 1`}},
	{struct{ x uint64 }{0}, struct{ x uint64 }{0}, nil},
	{struct{ x uint64 }{0}, struct{ x uint64 }{1}, []string{`x: 0 != 1`}},
	{struct{ x uintptr }{0}, struct{ x uintptr }{0}, nil},
	{struct{ x uintptr }{0}, struct{ x uintptr }{1}, []string{`x: 0 != 1`}},
	{struct{ x float32 }{0}, struct{ x float32 }{0}, nil},
	{struct{ x float32 }{0}, struct{ x float32 }{1}, []string{`x: 0 != 1`}},
	{struct{ x float64 }{0}, struct{ x float64 }{0}, nil},
	{struct{ x float64 }{0}, struct{ x float64 }{1}, []string{`x: 0 != 1`}},
	{struct{ x complex64 }{0}, struct{ x complex64 }{0}, nil},
	{struct{ x complex64 }{0}, struct{ x complex64 }{1}, []string{`x: (0+0i) != (1+0i)`}},
	{struct{ x complex128 }{0}, struct{ x complex128 }{0}, nil},
	{struct{ x complex128 }{0}, struct{ x complex128 }{1}, []string{`x: (0+0i) != (1+0i)`}},
	{struct{ x [1]int }{[1]int{0}}, struct{ x [1]int }{[1]int{0}}, nil},
	{struct{ x [1]int }{[1]int{0}}, struct{ x [1]int }{[1]int{1}}, []string{`x[0]: 0 != 1`}},
	{struct{ x chan int }{c0}, struct{ x chan int }{c0}, nil},
	{struct{ x chan int }{c0}, struct{ x chan int }{c1}, []string{fmt.Sprintf("x: %p != %p", c0, c1)}},
	{struct{ x func() }{f0}, struct{ x func() }{f0}, nil},
	{struct{ x func() }{f0}, struct{ x func() }{f1}, []string{fmt.Sprintf("x: %p != %p", f0, f1)}},
	{struct{ x interface{} }{0}, struct{ x interface{} }{0}, nil},
	{struct{ x interface{} }{0}, struct{ x interface{} }{1}, []string{`x: 0 != 1`}},
	{struct{ x interface{} }{0}, struct{ x interface{} }{""}, []string{`x: int != string`}},
	{struct{ x interface{} }{0}, struct{ x interface{} }{nil}, []string{`x: int(0) != nil`}},
	{struct{ x interface{} }{nil}, struct{ x interface{} }{0}, []string{`x: nil != int(0)`}},
	{struct{ x map[int]int }{map[int]int{0: 0}}, struct{ x map[int]int }{map[int]int{0: 0}}, nil},
	{struct{ x map[int]int }{map[int]int{0: 0}}, struct{ x map[int]int }{map[int]int{0: 1}}, []string{`x[0]: 0 != 1`}},
	{struct{ x *int }{new(int)}, struct{ x *int }{new(int)}, nil},
	{struct{ x *int }{&i0}, struct{ x *int }{&i1}, []string{`x: 0 != 1`}},
	{struct{ x *int }{nil}, struct{ x *int }{&i0}, []string{`x: nil != &int(0)`}},
	{struct{ x *int }{&i0}, struct{ x *int }{nil}, []string{`x: &int(0) != nil`}},
	{struct{ x []int }{[]int{0}}, struct{ x []int }{[]int{0}}, nil},
	{struct{ x []int }{[]int{0}}, struct{ x []int }{[]int{1}}, []string{`x[0]: 0 != 1`}},
	{struct{ x string }{"a"}, struct{ x string }{"a"}, nil},
	{struct{ x string }{"a"}, struct{ x string }{"b"}, []string{`x: "a" != "b"`}},
	{struct{ x N }{N{0}}, struct{ x N }{N{0}}, nil},
	{struct{ x N }{N{0}}, struct{ x N }{N{1}}, []string{`x.N: 0 != 1`}},
	{
		struct{ x unsafe.Pointer }{unsafe.Pointer(uintptr(0))},
		struct{ x unsafe.Pointer }{unsafe.Pointer(uintptr(0))},
		nil,
	},
	{
		struct{ x unsafe.Pointer }{unsafe.Pointer(uintptr(0))},
		struct{ x unsafe.Pointer }{unsafe.Pointer(uintptr(1))},
		[]string{`x: 0x0 != 0x1`},
	},
}

func TestDiff(t *testing.T) {
	for _, tt := range diffs {
		got := Diff(tt.a, tt.b)
		eq := len(got) == len(tt.exp)
		if eq {
			for i := range got {
				eq = eq && got[i] == tt.exp[i]
			}
		}
		if !eq {
			t.Errorf("diffing % #v", tt.a)
			t.Errorf("with    % #v", tt.b)
			diffdiff(t, got, tt.exp)
			continue
		}
	}
}

func TestKeyEqual(t *testing.T) {
	var emptyInterfaceZero interface{} = 0

	cases := []interface{}{
		new(bool),
		new(int),
		new(int8),
		new(int16),
		new(int32),
		new(int64),
		new(uint),
		new(uint8),
		new(uint16),
		new(uint32),
		new(uint64),
		new(uintptr),
		new(float32),
		new(float64),
		new(complex64),
		new(complex128),
		new([1]int),
		new(chan int),
		new(unsafe.Pointer),
		new(interface{}),
		&emptyInterfaceZero,
		new(*int),
		new(string),
		new(struct{ int }),
	}

	for _, test := range cases {
		rv := reflect.ValueOf(test).Elem()
		if !keyEqual(rv, rv) {
			t.Errorf("keyEqual(%s, %s) = false want true", rv.Type(), rv.Type())
		}
	}
}

func TestFdiff(t *testing.T) {
	var buf bytes.Buffer
	Fdiff(&buf, 0, 1)
	want := "0 != 1\n"
	if got := buf.String(); got != want {
		t.Errorf("Fdiff(0, 1) = %q want %q", got, want)
	}
}

func diffdiff(t *testing.T, got, exp []string) {
	minus(t, "unexpected:", got, exp)
	minus(t, "missing:", exp, got)
}

func minus(t *testing.T, s string, a, b []string) {
	var i, j int
	for i = 0; i < len(a); i++ {
		for j = 0; j < len(b); j++ {
			if a[i] == b[j] {
				break
			}
		}
		if j == len(b) {
			t.Error(s, a[i])
		}
	}
}
