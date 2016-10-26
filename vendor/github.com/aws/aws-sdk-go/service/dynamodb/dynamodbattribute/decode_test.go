package dynamodbattribute

import (
	"fmt"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/stretchr/testify/assert"
)

func TestUnmarshalErrorTypes(t *testing.T) {
	var _ awserr.Error = (*UnmarshalTypeError)(nil)
	var _ awserr.Error = (*InvalidUnmarshalError)(nil)
}

func TestUnmarshalShared(t *testing.T) {
	for i, c := range sharedTestCases {
		err := Unmarshal(c.in, c.actual)
		assertConvertTest(t, i, c.actual, c.expected, err, c.err)
	}
}

func TestUnmarshal(t *testing.T) {
	cases := []struct {
		in               *dynamodb.AttributeValue
		actual, expected interface{}
		err              error
	}{
		//------------
		// Sets
		//------------
		{
			in: &dynamodb.AttributeValue{BS: [][]byte{
				{48, 49}, {50, 51},
			}},
			actual:   &[][]byte{},
			expected: [][]byte{{48, 49}, {50, 51}},
		},
		{
			in: &dynamodb.AttributeValue{NS: []*string{
				aws.String("123"), aws.String("321"),
			}},
			actual:   &[]int{},
			expected: []int{123, 321},
		},
		{
			in: &dynamodb.AttributeValue{NS: []*string{
				aws.String("123"), aws.String("321"),
			}},
			actual:   &[]interface{}{},
			expected: []interface{}{123., 321.},
		},
		{
			in: &dynamodb.AttributeValue{SS: []*string{
				aws.String("abc"), aws.String("123"),
			}},
			actual:   &[]string{},
			expected: &[]string{"abc", "123"},
		},
		{
			in: &dynamodb.AttributeValue{SS: []*string{
				aws.String("abc"), aws.String("123"),
			}},
			actual:   &[]*string{},
			expected: &[]*string{aws.String("abc"), aws.String("123")},
		},
		//------------
		// Interfaces
		//------------
		{
			in: &dynamodb.AttributeValue{B: []byte{48, 49}},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: []byte{48, 49},
		},
		{
			in: &dynamodb.AttributeValue{BS: [][]byte{
				{48, 49}, {50, 51},
			}},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: [][]byte{{48, 49}, {50, 51}},
		},
		{
			in: &dynamodb.AttributeValue{BOOL: aws.Bool(true)},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: bool(true),
		},
		{
			in: &dynamodb.AttributeValue{L: []*dynamodb.AttributeValue{
				{S: aws.String("abc")}, {S: aws.String("123")},
			}},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: []interface{}{"abc", "123"},
		},
		{
			in: &dynamodb.AttributeValue{M: map[string]*dynamodb.AttributeValue{
				"123": {S: aws.String("abc")},
				"abc": {S: aws.String("123")},
			}},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: map[string]interface{}{"123": "abc", "abc": "123"},
		},
		{
			in: &dynamodb.AttributeValue{N: aws.String("123")},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: float64(123),
		},
		{
			in: &dynamodb.AttributeValue{NS: []*string{
				aws.String("123"), aws.String("321"),
			}},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: []float64{123., 321.},
		},
		{
			in: &dynamodb.AttributeValue{S: aws.String("123")},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: "123",
		},
		{
			in: &dynamodb.AttributeValue{SS: []*string{
				aws.String("123"), aws.String("321"),
			}},
			actual: func() interface{} {
				var v interface{}
				return &v
			}(),
			expected: []string{"123", "321"},
		},
		{
			in: &dynamodb.AttributeValue{M: map[string]*dynamodb.AttributeValue{
				"abc": {S: aws.String("123")},
				"Cba": {S: aws.String("321")},
			}},
			actual:   &struct{ Abc, Cba string }{},
			expected: struct{ Abc, Cba string }{Abc: "123", Cba: "321"},
		},
		{
			in:     &dynamodb.AttributeValue{N: aws.String("512")},
			actual: new(uint8),
			err: &UnmarshalTypeError{
				Value: fmt.Sprintf("number overflow, 512"),
				Type:  reflect.TypeOf(uint8(0)),
			},
		},
	}

	for i, c := range cases {
		err := Unmarshal(c.in, c.actual)
		assertConvertTest(t, i, c.actual, c.expected, err, c.err)
	}
}

func TestInterfaceInput(t *testing.T) {
	var v interface{}
	expected := []interface{}{"abc", "123"}
	err := Unmarshal(&dynamodb.AttributeValue{L: []*dynamodb.AttributeValue{
		{S: aws.String("abc")}, {S: aws.String("123")},
	}}, &v)
	assertConvertTest(t, 0, v, expected, err, nil)
}

func TestUnmarshalError(t *testing.T) {
	cases := []struct {
		in               *dynamodb.AttributeValue
		actual, expected interface{}
		err              error
	}{
		{
			in:       &dynamodb.AttributeValue{},
			actual:   int(0),
			expected: nil,
			err:      &InvalidUnmarshalError{Type: reflect.TypeOf(int(0))},
		},
	}

	for i, c := range cases {
		err := Unmarshal(c.in, c.actual)
		assertConvertTest(t, i, c.actual, c.expected, err, c.err)
	}
}

func TestUnmarshalListShared(t *testing.T) {
	for i, c := range sharedListTestCases {
		err := UnmarshalList(c.in, c.actual)
		assertConvertTest(t, i, c.actual, c.expected, err, c.err)
	}
}

func TestUnmarshalListError(t *testing.T) {
	cases := []struct {
		in               []*dynamodb.AttributeValue
		actual, expected interface{}
		err              error
	}{
		{
			in:       []*dynamodb.AttributeValue{},
			actual:   []interface{}{},
			expected: nil,
			err:      &InvalidUnmarshalError{Type: reflect.TypeOf([]interface{}{})},
		},
	}

	for i, c := range cases {
		err := UnmarshalList(c.in, c.actual)
		assertConvertTest(t, i, c.actual, c.expected, err, c.err)
	}
}

func TestUnmarshalMapShared(t *testing.T) {
	for i, c := range sharedMapTestCases {
		err := UnmarshalMap(c.in, c.actual)
		assertConvertTest(t, i, c.actual, c.expected, err, c.err)
	}
}

func TestUnmarshalMapError(t *testing.T) {
	cases := []struct {
		in               map[string]*dynamodb.AttributeValue
		actual, expected interface{}
		err              error
	}{
		{
			in:       map[string]*dynamodb.AttributeValue{},
			actual:   map[string]interface{}{},
			expected: nil,
			err:      &InvalidUnmarshalError{Type: reflect.TypeOf(map[string]interface{}{})},
		},
		{
			in: map[string]*dynamodb.AttributeValue{
				"BOOL": {BOOL: aws.Bool(true)},
			},
			actual:   &map[int]interface{}{},
			expected: nil,
			err:      &UnmarshalTypeError{Value: "map string key", Type: reflect.TypeOf(int(0))},
		},
	}

	for i, c := range cases {
		err := UnmarshalMap(c.in, c.actual)
		assertConvertTest(t, i, c.actual, c.expected, err, c.err)
	}
}

type unmarshalUnmarshaler struct {
	Value  string
	Value2 int
	Value3 bool
	Value4 time.Time
}

func (u *unmarshalUnmarshaler) UnmarshalDynamoDBAttributeValue(av *dynamodb.AttributeValue) error {
	if av.M == nil {
		return fmt.Errorf("expected AttributeValue to be map")
	}

	if v, ok := av.M["abc"]; !ok {
		return fmt.Errorf("expected `abc` map key")
	} else if v.S == nil {
		return fmt.Errorf("expected `abc` map value string")
	} else {
		u.Value = *v.S
	}

	if v, ok := av.M["def"]; !ok {
		return fmt.Errorf("expected `def` map key")
	} else if v.N == nil {
		return fmt.Errorf("expected `def` map value number")
	} else {
		n, err := strconv.ParseInt(*v.N, 10, 64)
		if err != nil {
			return err
		}
		u.Value2 = int(n)
	}

	if v, ok := av.M["ghi"]; !ok {
		return fmt.Errorf("expected `ghi` map key")
	} else if v.BOOL == nil {
		return fmt.Errorf("expected `ghi` map value number")
	} else {
		u.Value3 = *v.BOOL
	}

	if v, ok := av.M["jkl"]; !ok {
		return fmt.Errorf("expected `jkl` map key")
	} else if v.S == nil {
		return fmt.Errorf("expected `jkl` map value string")
	} else {
		t, err := time.Parse(time.RFC3339, *v.S)
		if err != nil {
			return err
		}
		u.Value4 = t
	}

	return nil
}

func TestUnmarshalUnmashaler(t *testing.T) {
	u := &unmarshalUnmarshaler{}
	av := &dynamodb.AttributeValue{
		M: map[string]*dynamodb.AttributeValue{
			"abc": {S: aws.String("value")},
			"def": {N: aws.String("123")},
			"ghi": {BOOL: aws.Bool(true)},
			"jkl": {S: aws.String("2016-05-03T17:06:26.209072Z")},
		},
	}

	err := Unmarshal(av, u)
	assert.NoError(t, err)

	assert.Equal(t, "value", u.Value)
	assert.Equal(t, 123, u.Value2)
	assert.Equal(t, true, u.Value3)
	assert.Equal(t, testDate, u.Value4)
}

func TestDecodeUseNumber(t *testing.T) {
	u := map[string]interface{}{}
	av := &dynamodb.AttributeValue{
		M: map[string]*dynamodb.AttributeValue{
			"abc": {S: aws.String("value")},
			"def": {N: aws.String("123")},
			"ghi": {BOOL: aws.Bool(true)},
		},
	}

	decoder := NewDecoder(func(d *Decoder) {
		d.UseNumber = true
	})
	err := decoder.Decode(av, &u)
	assert.NoError(t, err)

	assert.Equal(t, "value", u["abc"])
	n, ok := u["def"].(Number)
	assert.True(t, ok)
	assert.Equal(t, "123", n.String())
	assert.Equal(t, true, u["ghi"])
}

func TestDecodeUseNumberNumberSet(t *testing.T) {
	u := map[string]interface{}{}
	av := &dynamodb.AttributeValue{
		M: map[string]*dynamodb.AttributeValue{
			"ns": {
				NS: []*string{
					aws.String("123"), aws.String("321"),
				},
			},
		},
	}

	decoder := NewDecoder(func(d *Decoder) {
		d.UseNumber = true
	})
	err := decoder.Decode(av, &u)
	assert.NoError(t, err)

	ns, ok := u["ns"].([]Number)
	assert.True(t, ok)

	assert.Equal(t, "123", ns[0].String())
	assert.Equal(t, "321", ns[1].String())
}
