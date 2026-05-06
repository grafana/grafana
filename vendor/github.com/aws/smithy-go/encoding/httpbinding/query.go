package httpbinding

import (
	"encoding/base64"
	"math"
	"math/big"
	"net/url"
	"strconv"
)

// QueryValue is used to encode query key values
type QueryValue struct {
	query  url.Values
	key    string
	append bool
}

// NewQueryValue creates a new QueryValue which enables encoding
// a query value into the given url.Values.
func NewQueryValue(query url.Values, key string, append bool) QueryValue {
	return QueryValue{
		query:  query,
		key:    key,
		append: append,
	}
}

func (qv QueryValue) updateKey(value string) {
	if qv.append {
		qv.query.Add(qv.key, value)
	} else {
		qv.query.Set(qv.key, value)
	}
}

// Blob encodes v as a base64 query string value
func (qv QueryValue) Blob(v []byte) {
	encodeToString := base64.StdEncoding.EncodeToString(v)
	qv.updateKey(encodeToString)
}

// Boolean encodes v as a query string value
func (qv QueryValue) Boolean(v bool) {
	qv.updateKey(strconv.FormatBool(v))
}

// String encodes v as a query string value
func (qv QueryValue) String(v string) {
	qv.updateKey(v)
}

// Byte encodes v as a query string value
func (qv QueryValue) Byte(v int8) {
	qv.Long(int64(v))
}

// Short encodes v as a query string value
func (qv QueryValue) Short(v int16) {
	qv.Long(int64(v))
}

// Integer encodes v as a query string value
func (qv QueryValue) Integer(v int32) {
	qv.Long(int64(v))
}

// Long encodes v as a query string value
func (qv QueryValue) Long(v int64) {
	qv.updateKey(strconv.FormatInt(v, 10))
}

// Float encodes v as a query string value
func (qv QueryValue) Float(v float32) {
	qv.float(float64(v), 32)
}

// Double encodes v as a query string value
func (qv QueryValue) Double(v float64) {
	qv.float(v, 64)
}

func (qv QueryValue) float(v float64, bitSize int) {
	switch {
	case math.IsNaN(v):
		qv.String(floatNaN)
	case math.IsInf(v, 1):
		qv.String(floatInfinity)
	case math.IsInf(v, -1):
		qv.String(floatNegInfinity)
	default:
		qv.updateKey(strconv.FormatFloat(v, 'f', -1, bitSize))
	}
}

// BigInteger encodes v as a query string value
func (qv QueryValue) BigInteger(v *big.Int) {
	qv.updateKey(v.String())
}

// BigDecimal encodes v as a query string value
func (qv QueryValue) BigDecimal(v *big.Float) {
	if i, accuracy := v.Int64(); accuracy == big.Exact {
		qv.Long(i)
		return
	}
	qv.updateKey(v.Text('e', -1))
}
