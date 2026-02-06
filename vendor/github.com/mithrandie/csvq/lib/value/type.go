package value

import (
	"strconv"
	"time"

	"github.com/mithrandie/csvq/lib/option"

	"github.com/mithrandie/ternary"
)

var ternaryTrue = &Ternary{value: ternary.TRUE}
var ternaryFalse = &Ternary{value: ternary.FALSE}
var ternaryUnknown = &Ternary{value: ternary.UNKNOWN}
var booleanTrue = &Boolean{value: true}
var booleanFalse = &Boolean{value: false}
var null = &Null{}

func IsTrue(v Primary) bool {
	return v == ternaryTrue
}

func IsFalse(v Primary) bool {
	return v == ternaryFalse
}

func IsUnknown(v Primary) bool {
	return v == ternaryUnknown
}

func IsNull(v Primary) bool {
	return v == null
}

type RowValue []Primary

type Primary interface {
	String() string
	Ternary() ternary.Value
}

type String struct {
	literal string
}

func (s String) String() string {
	return option.QuoteString(s.literal)
}

func NewString(s string) *String {
	p := getString()
	p.literal = s
	return p
}

func (s String) Raw() string {
	return s.literal
}

func (s String) Ternary() ternary.Value {
	lit := option.TrimSpace(s.Raw())
	if b, err := strconv.ParseBool(lit); err == nil {
		return ternary.ConvertFromBool(b)
	}
	return ternary.UNKNOWN
}

type Integer struct {
	value int64
}

func NewIntegerFromString(s string) *Integer {
	i, _ := strconv.ParseInt(s, 10, 64)
	return NewInteger(i)
}

func NewInteger(i int64) *Integer {
	p := getInteger()
	p.value = i
	return p
}

func (i Integer) String() string {
	return Int64ToStr(i.value)
}

func (i Integer) Raw() int64 {
	return i.value
}

func (i Integer) Ternary() ternary.Value {
	switch i.Raw() {
	case 0:
		return ternary.FALSE
	case 1:
		return ternary.TRUE
	default:
		return ternary.UNKNOWN
	}
}

type Float struct {
	value float64
}

func NewFloatFromString(s string) *Float {
	f, _ := strconv.ParseFloat(s, 64)
	return NewFloat(f)
}

func NewFloat(f float64) *Float {
	p := getFloat()
	p.value = f
	return p
}

func (f Float) String() string {
	return Float64ToStr(f.value, false)
}

func (f Float) Raw() float64 {
	return f.value
}

func (f Float) Ternary() ternary.Value {
	switch f.Raw() {
	case 0:
		return ternary.FALSE
	case 1:
		return ternary.TRUE
	default:
		return ternary.UNKNOWN
	}
}

type Boolean struct {
	value bool
}

func NewBoolean(b bool) *Boolean {
	switch b {
	case true:
		return booleanTrue
	default:
		return booleanFalse
	}
}

func (b Boolean) String() string {
	return strconv.FormatBool(b.value)
}

func (b Boolean) Raw() bool {
	return b.value
}

func (b Boolean) Ternary() ternary.Value {
	return ternary.ConvertFromBool(b.Raw())
}

type Ternary struct {
	value ternary.Value
}

func NewTernaryFromString(s string) *Ternary {
	t, _ := ternary.ConvertFromString(s)
	return NewTernary(t)
}

func NewTernary(t ternary.Value) *Ternary {
	switch t {
	case ternary.TRUE:
		return ternaryTrue
	case ternary.FALSE:
		return ternaryFalse
	default:
		return ternaryUnknown
	}
}

func (t Ternary) String() string {
	return t.value.String()
}

func (t Ternary) Ternary() ternary.Value {
	return t.value
}

type Datetime struct {
	value time.Time
}

func NewDatetimeFromString(s string, formats []string, location *time.Location) *Datetime {
	t, _ := StrToTime(s, formats, location)
	return NewDatetime(t)
}

func NewDatetime(t time.Time) *Datetime {
	p := getDatetime()
	p.value = t
	return p
}

func (dt Datetime) String() string {
	return option.QuoteString(dt.value.Format(time.RFC3339Nano))
}

func (dt Datetime) Raw() time.Time {
	return dt.value
}

func (dt Datetime) Ternary() ternary.Value {
	return ternary.UNKNOWN
}

func (dt Datetime) Format(s string) string {
	return dt.value.Format(s)
}

type Null struct{}

func NewNull() *Null {
	return null
}

func (n Null) String() string {
	return "NULL"
}

func (n Null) Ternary() ternary.Value {
	return ternary.UNKNOWN
}
