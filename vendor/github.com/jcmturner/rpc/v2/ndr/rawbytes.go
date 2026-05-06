package ndr

import (
	"errors"
	"fmt"
	"reflect"
	"strconv"
)

// type MyBytes []byte
// implement RawBytes interface

const (
	sizeMethod = "Size"
)

// RawBytes interface should be implemented if reading just a number of bytes from the NDR stream
type RawBytes interface {
	Size(interface{}) int
}

func rawBytesSize(parent reflect.Value, v reflect.Value) (int, error) {
	sf := v.MethodByName(sizeMethod)
	if !sf.IsValid() {
		return 0, fmt.Errorf("could not find a method called %s on the implementation of RawBytes", sizeMethod)
	}
	in := []reflect.Value{parent}
	f := sf.Call(in)
	if f[0].Kind() != reflect.Int {
		return 0, errors.New("the RawBytes size function did not return an integer")
	}
	return int(f[0].Int()), nil
}

func addSizeToTag(parent reflect.Value, v reflect.Value, tag reflect.StructTag) (reflect.StructTag, error) {
	size, err := rawBytesSize(parent, v)
	if err != nil {
		return tag, err
	}
	ndrTag := parseTags(tag)
	ndrTag.Map["size"] = strconv.Itoa(size)
	return ndrTag.StructTag(), nil
}

func (dec *Decoder) readRawBytes(v reflect.Value, tag reflect.StructTag) error {
	ndrTag := parseTags(tag)
	sizeStr, ok := ndrTag.Map["size"]
	if !ok {
		return errors.New("size tag not available")
	}
	size, err := strconv.Atoi(sizeStr)
	if err != nil {
		return fmt.Errorf("size not valid: %v", err)
	}
	b, err := dec.readBytes(size)
	if err != nil {
		return err
	}
	v.Set(reflect.ValueOf(b).Convert(v.Type()))
	return nil
}
