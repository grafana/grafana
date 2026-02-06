package httpbinding

import (
	"encoding/base64"
	"math"
	"math/big"
	"net/http"
	"strconv"
	"strings"
)

// Headers is used to encode header keys using a provided prefix
type Headers struct {
	header http.Header
	prefix string
}

// AddHeader returns a HeaderValue used to append values to prefix+key
func (h Headers) AddHeader(key string) HeaderValue {
	return h.newHeaderValue(key, true)
}

// SetHeader returns a HeaderValue used to set the value of prefix+key
func (h Headers) SetHeader(key string) HeaderValue {
	return h.newHeaderValue(key, false)
}

func (h Headers) newHeaderValue(key string, append bool) HeaderValue {
	return newHeaderValue(h.header, h.prefix+strings.TrimSpace(key), append)
}

// HeaderValue is used to encode values to an HTTP header
type HeaderValue struct {
	header http.Header
	key    string
	append bool
}

func newHeaderValue(header http.Header, key string, append bool) HeaderValue {
	return HeaderValue{header: header, key: strings.TrimSpace(key), append: append}
}

func (h HeaderValue) modifyHeader(value string) {
	if h.append {
		h.header[h.key] = append(h.header[h.key], value)
	} else {
		h.header[h.key] = append(h.header[h.key][:0], value)
	}
}

// String encodes the value v as the header string value
func (h HeaderValue) String(v string) {
	h.modifyHeader(v)
}

// Byte encodes the value v as a query string value
func (h HeaderValue) Byte(v int8) {
	h.Long(int64(v))
}

// Short encodes the value v as a query string value
func (h HeaderValue) Short(v int16) {
	h.Long(int64(v))
}

// Integer encodes the value v as the header string value
func (h HeaderValue) Integer(v int32) {
	h.Long(int64(v))
}

// Long encodes the value v as the header string value
func (h HeaderValue) Long(v int64) {
	h.modifyHeader(strconv.FormatInt(v, 10))
}

// Boolean encodes the value v as a query string value
func (h HeaderValue) Boolean(v bool) {
	h.modifyHeader(strconv.FormatBool(v))
}

// Float encodes the value v as a query string value
func (h HeaderValue) Float(v float32) {
	h.float(float64(v), 32)
}

// Double encodes the value v as a query string value
func (h HeaderValue) Double(v float64) {
	h.float(v, 64)
}

func (h HeaderValue) float(v float64, bitSize int) {
	switch {
	case math.IsNaN(v):
		h.String(floatNaN)
	case math.IsInf(v, 1):
		h.String(floatInfinity)
	case math.IsInf(v, -1):
		h.String(floatNegInfinity)
	default:
		h.modifyHeader(strconv.FormatFloat(v, 'f', -1, bitSize))
	}
}

// BigInteger encodes the value v as a query string value
func (h HeaderValue) BigInteger(v *big.Int) {
	h.modifyHeader(v.String())
}

// BigDecimal encodes the value v as a query string value
func (h HeaderValue) BigDecimal(v *big.Float) {
	if i, accuracy := v.Int64(); accuracy == big.Exact {
		h.Long(i)
		return
	}
	h.modifyHeader(v.Text('e', -1))
}

// Blob encodes the value v as a base64 header string value
func (h HeaderValue) Blob(v []byte) {
	encodeToString := base64.StdEncoding.EncodeToString(v)
	h.modifyHeader(encodeToString)
}
