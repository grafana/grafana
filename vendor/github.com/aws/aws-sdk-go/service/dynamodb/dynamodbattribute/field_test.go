package dynamodbattribute

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
)

type testUnionValues struct {
	Name  string
	Value interface{}
}

type unionSimple struct {
	A int
	B string
	C []string
}

type unionComplex struct {
	unionSimple
	A int
}

type unionTagged struct {
	A int `json:"A"`
}

type unionTaggedComplex struct {
	unionSimple
	unionTagged
	B string
}

func TestUnionStructFields(t *testing.T) {
	var cases = []struct {
		in     interface{}
		expect []testUnionValues
	}{
		{
			in: unionSimple{1, "2", []string{"abc"}},
			expect: []testUnionValues{
				{"A", 1},
				{"B", "2"},
				{"C", []string{"abc"}},
			},
		},
		{
			in: unionComplex{
				unionSimple: unionSimple{1, "2", []string{"abc"}},
				A:           2,
			},
			expect: []testUnionValues{
				{"B", "2"},
				{"C", []string{"abc"}},
				{"A", 2},
			},
		},
		{
			in: unionTaggedComplex{
				unionSimple: unionSimple{1, "2", []string{"abc"}},
				unionTagged: unionTagged{3},
				B:           "3",
			},
			expect: []testUnionValues{
				{"C", []string{"abc"}},
				{"A", 3},
				{"B", "3"},
			},
		},
	}

	for i, c := range cases {
		v := reflect.ValueOf(c.in)

		fields := unionStructFields(v.Type(), MarshalOptions{SupportJSONTags: true})
		for j, f := range fields {
			expected := c.expect[j]
			assert.Equal(t, expected.Name, f.Name, "case %d, field %d", i, j)
			actual := v.FieldByIndex(f.Index).Interface()
			assert.EqualValues(t, expected.Value, actual, "case %d, field %d", i, j)
		}
	}
}

func TestFieldByName(t *testing.T) {
	fields := []field{
		{Name: "Abc"}, {Name: "mixCase"}, {Name: "UPPERCASE"},
	}

	cases := []struct {
		Name, FieldName string
		Found           bool
	}{
		{"abc", "Abc", true}, {"ABC", "Abc", true}, {"Abc", "Abc", true},
		{"123", "", false},
		{"ab", "", false},
		{"MixCase", "mixCase", true},
		{"uppercase", "UPPERCASE", true}, {"UPPERCASE", "UPPERCASE", true},
	}

	for _, c := range cases {
		f, ok := fieldByName(fields, c.Name)
		assert.Equal(t, c.Found, ok)
		if ok {
			assert.Equal(t, c.FieldName, f.Name)
		}
	}
}
