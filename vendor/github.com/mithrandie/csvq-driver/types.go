package csvq

import (
	"database/sql/driver"
	"time"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/ternary"
)

type Value interface {
	Value() (driver.Value, error)
	PrimitiveType() parser.PrimitiveType
}

type String struct {
	value string
}

func (t String) Value() (driver.Value, error) {
	return t.value, nil
}

func (t String) PrimitiveType() parser.PrimitiveType {
	return parser.NewStringValue(t.value)
}

type Integer struct {
	value int64
}

func (t Integer) Value() (driver.Value, error) {
	return t.value, nil
}

func (t Integer) PrimitiveType() parser.PrimitiveType {
	return parser.NewIntegerValue(t.value)
}

type Float struct {
	value float64
}

func (t Float) Value() (driver.Value, error) {
	return t.value, nil
}

func (t Float) PrimitiveType() parser.PrimitiveType {
	return parser.NewFloatValue(t.value)
}

type Boolean struct {
	value bool
}

func (t Boolean) Value() (driver.Value, error) {
	return t.value, nil
}

func (t Boolean) PrimitiveType() parser.PrimitiveType {
	return parser.NewTernaryValue(ternary.ConvertFromBool(t.value))
}

type Datetime struct {
	value time.Time
}

func (t Datetime) Value() (driver.Value, error) {
	return t.value, nil
}

func (t Datetime) PrimitiveType() parser.PrimitiveType {
	return parser.NewDatetimeValue(t.value)
}

type Null struct {
}

func (t Null) Value() (driver.Value, error) {
	return nil, nil
}

func (t Null) PrimitiveType() parser.PrimitiveType {
	return parser.NewNullValue()
}
