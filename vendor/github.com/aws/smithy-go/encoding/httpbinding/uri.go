package httpbinding

import (
	"math"
	"math/big"
	"strconv"
	"strings"
)

// URIValue is used to encode named URI parameters
type URIValue struct {
	path, rawPath, buffer *[]byte

	key string
}

func newURIValue(path *[]byte, rawPath *[]byte, buffer *[]byte, key string) URIValue {
	return URIValue{path: path, rawPath: rawPath, buffer: buffer, key: key}
}

func (u URIValue) modifyURI(value string) (err error) {
	*u.path, *u.buffer, err = replacePathElement(*u.path, *u.buffer, u.key, value, false)
	if err != nil {
		return err
	}
	*u.rawPath, *u.buffer, err = replacePathElement(*u.rawPath, *u.buffer, u.key, value, true)
	return err
}

// Boolean encodes v as a URI string value
func (u URIValue) Boolean(v bool) error {
	return u.modifyURI(strconv.FormatBool(v))
}

// String encodes v as a URI string value
func (u URIValue) String(v string) error {
	return u.modifyURI(v)
}

// Byte encodes v as a URI string value
func (u URIValue) Byte(v int8) error {
	return u.Long(int64(v))
}

// Short encodes v as a URI string value
func (u URIValue) Short(v int16) error {
	return u.Long(int64(v))
}

// Integer encodes v as a URI string value
func (u URIValue) Integer(v int32) error {
	return u.Long(int64(v))
}

// Long encodes v as a URI string value
func (u URIValue) Long(v int64) error {
	return u.modifyURI(strconv.FormatInt(v, 10))
}

// Float encodes v as a query string value
func (u URIValue) Float(v float32) error {
	return u.float(float64(v), 32)
}

// Double encodes v as a query string value
func (u URIValue) Double(v float64) error {
	return u.float(v, 64)
}

func (u URIValue) float(v float64, bitSize int) error {
	switch {
	case math.IsNaN(v):
		return u.String(floatNaN)
	case math.IsInf(v, 1):
		return u.String(floatInfinity)
	case math.IsInf(v, -1):
		return u.String(floatNegInfinity)
	default:
		return u.modifyURI(strconv.FormatFloat(v, 'f', -1, bitSize))
	}
}

// BigInteger encodes v as a query string value
func (u URIValue) BigInteger(v *big.Int) error {
	return u.modifyURI(v.String())
}

// BigDecimal encodes v as a query string value
func (u URIValue) BigDecimal(v *big.Float) error {
	if i, accuracy := v.Int64(); accuracy == big.Exact {
		return u.Long(i)
	}
	return u.modifyURI(v.Text('e', -1))
}

// SplitURI parses a Smithy HTTP binding trait URI
func SplitURI(uri string) (path, query string) {
	queryStart := strings.IndexRune(uri, '?')
	if queryStart == -1 {
		path = uri
		return path, query
	}

	path = uri[:queryStart]
	if queryStart+1 >= len(uri) {
		return path, query
	}
	query = uri[queryStart+1:]

	return path, query
}
