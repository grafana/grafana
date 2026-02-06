package util

import (
	"net/url"
	"strconv"
)

type QueryStringBuilder struct {
	values url.Values
}

func NewQueryStringBuilder() *QueryStringBuilder {
	return &QueryStringBuilder{
		values: url.Values{},
	}
}

func (b *QueryStringBuilder) SetString(name, value string) {
	b.values.Set(name, value)
}

func (b *QueryStringBuilder) SetStringArray(name string, values []string) {
	for _, v := range values {
		b.values.Add(name, v)
	}
}

func (b *QueryStringBuilder) SetInt(name string, value int64) {
	b.SetString(name, strconv.FormatInt(value, 10))
}

func (b *QueryStringBuilder) SetInt32(name string, value int) {
	b.SetString(name, strconv.Itoa(value))
}

func (b *QueryStringBuilder) SetFloat(name string, value float64) {
	b.SetString(name, strconv.FormatFloat(value, 'f', -1, 64))
}

func (b *QueryStringBuilder) SetFloat32(name string, value float32) {
	b.SetString(name, strconv.FormatFloat(float64(value), 'f', -1, 32))
}

// Encode returns the URL-encoded query string based on key-value
// parameters added to the builder calling Set functions.
func (b *QueryStringBuilder) Encode() string {
	return b.values.Encode()
}
