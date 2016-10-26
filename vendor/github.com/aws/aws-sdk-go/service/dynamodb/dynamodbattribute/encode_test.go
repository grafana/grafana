package dynamodbattribute

import (
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/stretchr/testify/assert"
)

func TestMarshalErrorTypes(t *testing.T) {
	var _ awserr.Error = (*InvalidMarshalError)(nil)
	var _ awserr.Error = (*unsupportedMarshalTypeError)(nil)
}

func TestMarshalShared(t *testing.T) {
	for i, c := range sharedTestCases {
		av, err := Marshal(c.expected)
		assertConvertTest(t, i, av, c.in, err, c.err)
	}
}

func TestMarshalListShared(t *testing.T) {
	for i, c := range sharedListTestCases {
		av, err := MarshalList(c.expected)
		assertConvertTest(t, i, av, c.in, err, c.err)
	}
}

func TestMarshalMapShared(t *testing.T) {
	for i, c := range sharedMapTestCases {
		av, err := MarshalMap(c.expected)
		assertConvertTest(t, i, av, c.in, err, c.err)
	}
}

type marshalMarshaler struct {
	Value  string
	Value2 int
	Value3 bool
	Value4 time.Time
}

func (m *marshalMarshaler) MarshalDynamoDBAttributeValue(av *dynamodb.AttributeValue) error {
	av.M = map[string]*dynamodb.AttributeValue{
		"abc": {S: &m.Value},
		"def": {N: aws.String(fmt.Sprintf("%d", m.Value2))},
		"ghi": {BOOL: &m.Value3},
		"jkl": {S: aws.String(m.Value4.Format(time.RFC3339Nano))},
	}

	return nil
}

func TestMarshalMashaler(t *testing.T) {
	m := &marshalMarshaler{
		Value:  "value",
		Value2: 123,
		Value3: true,
		Value4: testDate,
	}

	expect := &dynamodb.AttributeValue{
		M: map[string]*dynamodb.AttributeValue{
			"abc": {S: aws.String("value")},
			"def": {N: aws.String("123")},
			"ghi": {BOOL: aws.Bool(true)},
			"jkl": {S: aws.String("2016-05-03T17:06:26.209072Z")},
		},
	}

	actual, err := Marshal(m)
	assert.NoError(t, err)

	assert.Equal(t, expect, actual)
}

type testOmitEmptyElemListStruct struct {
	Values []string `dynamodbav:",omitemptyelem"`
}

type testOmitEmptyElemMapStruct struct {
	Values map[string]interface{} `dynamodbav:",omitemptyelem"`
}

func TestMarshalListOmitEmptyElem(t *testing.T) {
	expect := &dynamodb.AttributeValue{
		M: map[string]*dynamodb.AttributeValue{
			"Values": {L: []*dynamodb.AttributeValue{
				{S: aws.String("abc")},
				{S: aws.String("123")},
			}},
		},
	}

	m := testOmitEmptyElemListStruct{Values: []string{"abc", "", "123"}}

	actual, err := Marshal(m)
	assert.NoError(t, err)
	assert.Equal(t, expect, actual)
}

func TestMarshalMapOmitEmptyElem(t *testing.T) {
	expect := &dynamodb.AttributeValue{
		M: map[string]*dynamodb.AttributeValue{
			"Values": {M: map[string]*dynamodb.AttributeValue{
				"abc": {N: aws.String("123")},
				"klm": {S: aws.String("abc")},
			}},
		},
	}

	m := testOmitEmptyElemMapStruct{Values: map[string]interface{}{
		"abc": 123.,
		"efg": nil,
		"hij": "",
		"klm": "abc",
	}}

	actual, err := Marshal(m)
	assert.NoError(t, err)
	assert.Equal(t, expect, actual)
}

type testOmitEmptyScalar struct {
	IntZero       int  `dynamodbav:",omitempty"`
	IntPtrNil     *int `dynamodbav:",omitempty"`
	IntPtrSetZero *int `dynamodbav:",omitempty"`
}

func TestMarshalOmitEmpty(t *testing.T) {
	expect := &dynamodb.AttributeValue{
		M: map[string]*dynamodb.AttributeValue{
			"IntPtrSetZero": {N: aws.String("0")},
		},
	}

	m := testOmitEmptyScalar{IntPtrSetZero: aws.Int(0)}

	actual, err := Marshal(m)
	assert.NoError(t, err)
	assert.Equal(t, expect, actual)
}
