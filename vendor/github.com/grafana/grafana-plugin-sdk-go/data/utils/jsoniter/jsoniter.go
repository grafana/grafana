// Package jsoniter wraps json-iterator/go's Iterator methods with error returns
// so linting can catch unchecked errors.
// The underlying iterator's Error property is returned and not reset.
// See json-iterator/go for method documentation and additional methods that
// can be added to this library.
package jsoniter

import (
	"io"

	j "github.com/json-iterator/go"
)

const (
	InvalidValue = j.InvalidValue
	StringValue  = j.StringValue
	NumberValue  = j.NumberValue
	NilValue     = j.NilValue
	BoolValue    = j.BoolValue
	ArrayValue   = j.ArrayValue
	ObjectValue  = j.ObjectValue
)

var (
	ConfigDefault                       = j.ConfigDefault
	ConfigCompatibleWithStandardLibrary = j.ConfigCompatibleWithStandardLibrary
)

type Stream = j.Stream
type ValEncoder = j.ValEncoder
type ValDecoder = j.ValDecoder

type Iterator struct {
	// named property instead of embedded so there is no
	// confusion about which method or property is called
	i *j.Iterator
}

func NewIterator(i *j.Iterator) *Iterator {
	return &Iterator{i}
}

func (iter *Iterator) ReadError() error {
	return iter.i.Error
}

func (iter *Iterator) SetError(err error) {
	iter.i.Error = err
}

func (iter *Iterator) Read() (interface{}, error) {
	return iter.i.Read(), iter.i.Error
}

func (iter *Iterator) ReadAny() (j.Any, error) {
	return iter.i.ReadAny(), iter.i.Error
}

func (iter *Iterator) ReadArray() (bool, error) {
	return iter.i.ReadArray(), iter.i.Error
}

func (iter *Iterator) ReadObject() (string, error) {
	return iter.i.ReadObject(), iter.i.Error
}

func (iter *Iterator) CanReadArray() bool {
	ok, err := iter.ReadArray()
	return ok && err == nil
}

func (iter *Iterator) ReadString() (string, error) {
	return iter.i.ReadString(), iter.i.Error
}

func (iter *Iterator) ReadStringAsSlice() ([]byte, error) {
	return iter.i.ReadStringAsSlice(), iter.i.Error
}

func (iter *Iterator) WhatIsNext() (j.ValueType, error) {
	return iter.i.WhatIsNext(), iter.i.Error
}

func (iter *Iterator) Skip() error {
	iter.i.Skip()
	return iter.i.Error
}

func (iter *Iterator) SkipAndReturnBytes() ([]byte, error) {
	return iter.i.SkipAndReturnBytes(), iter.i.Error
}

func (iter *Iterator) ReadVal(obj interface{}) error {
	iter.i.ReadVal(obj)
	return iter.i.Error
}

func (iter *Iterator) ReadFloat32() (float32, error) {
	return iter.i.ReadFloat32(), iter.i.Error
}

func (iter *Iterator) ReadFloat64() (float64, error) {
	return iter.i.ReadFloat64(), iter.i.Error
}

func (iter *Iterator) ReadInt() (int, error) {
	return iter.i.ReadInt(), iter.i.Error
}

func (iter *Iterator) ReadInt8() (int8, error) {
	return iter.i.ReadInt8(), iter.i.Error
}

func (iter *Iterator) ReadInt16() (int16, error) {
	return iter.i.ReadInt16(), iter.i.Error
}

func (iter *Iterator) ReadInt32() (int32, error) {
	return iter.i.ReadInt32(), iter.i.Error
}

func (iter *Iterator) ReadInt64() (int64, error) {
	return iter.i.ReadInt64(), iter.i.Error
}

func (iter *Iterator) ReadUint8() (uint8, error) {
	return iter.i.ReadUint8(), iter.i.Error
}

func (iter *Iterator) ReadUint16() (uint16, error) {
	return iter.i.ReadUint16(), iter.i.Error
}

func (iter *Iterator) ReadUint32() (uint32, error) {
	return iter.i.ReadUint32(), iter.i.Error
}

func (iter *Iterator) ReadUint64() (uint64, error) {
	return iter.i.ReadUint64(), iter.i.Error
}

func (iter *Iterator) ReadUint64Pointer() (*uint64, error) {
	u := iter.i.ReadUint64()
	if iter.i.Error != nil {
		return nil, iter.i.Error
	}
	return &u, nil
}

func (iter *Iterator) ReadNil() (bool, error) {
	return iter.i.ReadNil(), iter.i.Error
}

func (iter *Iterator) ReadBool() (bool, error) {
	return iter.i.ReadBool(), iter.i.Error
}

func (iter *Iterator) ReportError(op, msg string) error {
	iter.i.ReportError(op, msg)
	return iter.i.Error
}

func (iter *Iterator) Marshal(v interface{}) ([]byte, error) {
	return ConfigDefault.Marshal(v)
}

func (iter *Iterator) Unmarshal(data []byte, v interface{}) error {
	return ConfigDefault.Unmarshal(data, v)
}

func Parse(cfg j.API, reader io.Reader, bufSize int) (*Iterator, error) {
	iter := &Iterator{j.Parse(cfg, reader, bufSize)}
	return iter, iter.i.Error
}

func ParseBytes(cfg j.API, input []byte) (*Iterator, error) {
	iter := &Iterator{j.ParseBytes(cfg, input)}
	return iter, iter.i.Error
}

func ParseString(cfg j.API, input string) (*Iterator, error) {
	iter := &Iterator{j.ParseString(cfg, input)}
	return iter, iter.i.Error
}

func RegisterTypeEncoder(typ string, encoder ValEncoder) {
	j.RegisterTypeEncoder(typ, encoder)
}

func RegisterTypeDecoder(typ string, decoder ValDecoder) {
	j.RegisterTypeDecoder(typ, decoder)
}
