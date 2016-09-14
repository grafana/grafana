package core

import (
	"fmt"
	"reflect"
	"testing"
)

func TestPK(t *testing.T) {
	p := NewPK(1, 3, "string")
	str, err := p.ToString()
	if err != nil {
		t.Error(err)
	}
	fmt.Println(str)

	s := &PK{}
	err = s.FromString(str)
	if err != nil {
		t.Error(err)
	}
	fmt.Println(s)

	if len(*p) != len(*s) {
		t.Fatal("p", *p, "should be equal", *s)
	}

	for i, ori := range *p {
		if ori != (*s)[i] {
			t.Fatal("ori", ori, reflect.ValueOf(ori), "should be equal", (*s)[i], reflect.ValueOf((*s)[i]))
		}
	}
}
