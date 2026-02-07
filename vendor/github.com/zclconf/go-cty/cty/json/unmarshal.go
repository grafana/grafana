package json

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
)

func unmarshal(buf []byte, t cty.Type, path cty.Path) (cty.Value, error) {
	dec := bufDecoder(buf)

	tok, err := dec.Token()
	if err != nil {
		return cty.NilVal, path.NewError(err)
	}

	if tok == nil {
		return cty.NullVal(t), nil
	}

	if t == cty.DynamicPseudoType {
		return unmarshalDynamic(buf, path)
	}

	switch {
	case t.IsPrimitiveType():
		val, err := unmarshalPrimitive(tok, t, path)
		if err != nil {
			return cty.NilVal, err
		}
		return val, nil
	case t.IsListType():
		return unmarshalList(buf, t.ElementType(), path)
	case t.IsSetType():
		return unmarshalSet(buf, t.ElementType(), path)
	case t.IsMapType():
		return unmarshalMap(buf, t.ElementType(), path)
	case t.IsTupleType():
		return unmarshalTuple(buf, t.TupleElementTypes(), path)
	case t.IsObjectType():
		return unmarshalObject(buf, t.AttributeTypes(), path)
	case t.IsCapsuleType():
		return unmarshalCapsule(buf, t, path)
	default:
		return cty.NilVal, path.NewErrorf("unsupported type %s", t.FriendlyName())
	}
}

func unmarshalPrimitive(tok json.Token, t cty.Type, path cty.Path) (cty.Value, error) {

	switch t {
	case cty.Bool:
		switch v := tok.(type) {
		case bool:
			return cty.BoolVal(v), nil
		case string:
			val, err := convert.Convert(cty.StringVal(v), t)
			if err != nil {
				return cty.NilVal, path.NewError(err)
			}
			return val, nil
		default:
			return cty.NilVal, path.NewErrorf("bool is required")
		}
	case cty.Number:
		if v, ok := tok.(json.Number); ok {
			tok = string(v)
		}
		switch v := tok.(type) {
		case string:
			val, err := cty.ParseNumberVal(v)
			if err != nil {
				return cty.NilVal, path.NewError(err)
			}
			return val, nil
		default:
			return cty.NilVal, path.NewErrorf("number is required")
		}
	case cty.String:
		switch v := tok.(type) {
		case string:
			return cty.StringVal(v), nil
		case json.Number:
			return cty.StringVal(string(v)), nil
		case bool:
			val, err := convert.Convert(cty.BoolVal(v), t)
			if err != nil {
				return cty.NilVal, path.NewError(err)
			}
			return val, nil
		default:
			return cty.NilVal, path.NewErrorf("string is required")
		}
	default:
		// should never happen
		panic("unsupported primitive type")
	}
}

func unmarshalList(buf []byte, ety cty.Type, path cty.Path) (cty.Value, error) {
	dec := bufDecoder(buf)
	if err := requireDelim(dec, '['); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	var vals []cty.Value

	{
		path := append(path, nil)
		var idx int64

		for dec.More() {
			path[len(path)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(idx),
			}
			idx++

			rawVal, err := readRawValue(dec)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to read list value: %s", err)
			}

			el, err := unmarshal(rawVal, ety, path)
			if err != nil {
				return cty.NilVal, err
			}

			vals = append(vals, el)
		}
	}

	if err := requireDelim(dec, ']'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	if len(vals) == 0 {
		return cty.ListValEmpty(ety), nil
	}

	return cty.ListVal(vals), nil
}

func unmarshalSet(buf []byte, ety cty.Type, path cty.Path) (cty.Value, error) {
	dec := bufDecoder(buf)
	if err := requireDelim(dec, '['); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	var vals []cty.Value

	{
		path := append(path, nil)

		for dec.More() {
			path[len(path)-1] = cty.IndexStep{
				Key: cty.UnknownVal(ety),
			}

			rawVal, err := readRawValue(dec)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to read set value: %s", err)
			}

			el, err := unmarshal(rawVal, ety, path)
			if err != nil {
				return cty.NilVal, err
			}

			vals = append(vals, el)
		}
	}

	if err := requireDelim(dec, ']'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	if len(vals) == 0 {
		return cty.SetValEmpty(ety), nil
	}

	return cty.SetVal(vals), nil
}

func unmarshalMap(buf []byte, ety cty.Type, path cty.Path) (cty.Value, error) {
	dec := bufDecoder(buf)
	if err := requireDelim(dec, '{'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	vals := make(map[string]cty.Value)

	{
		path := append(path, nil)

		for dec.More() {
			path[len(path)-1] = cty.IndexStep{
				Key: cty.UnknownVal(cty.String),
			}

			var err error

			k, err := requireObjectKey(dec)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to read map key: %s", err)
			}

			path[len(path)-1] = cty.IndexStep{
				Key: cty.StringVal(k),
			}

			rawVal, err := readRawValue(dec)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to read map value: %s", err)
			}

			el, err := unmarshal(rawVal, ety, path)
			if err != nil {
				return cty.NilVal, err
			}

			vals[k] = el
		}
	}

	if err := requireDelim(dec, '}'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	if len(vals) == 0 {
		return cty.MapValEmpty(ety), nil
	}

	return cty.MapVal(vals), nil
}

func unmarshalTuple(buf []byte, etys []cty.Type, path cty.Path) (cty.Value, error) {
	dec := bufDecoder(buf)
	if err := requireDelim(dec, '['); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	var vals []cty.Value

	{
		path := append(path, nil)
		var idx int

		for dec.More() {
			if idx >= len(etys) {
				return cty.NilVal, path[:len(path)-1].NewErrorf("too many tuple elements (need %d)", len(etys))
			}

			path[len(path)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(int64(idx)),
			}
			ety := etys[idx]
			idx++

			rawVal, err := readRawValue(dec)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to read tuple value: %s", err)
			}

			el, err := unmarshal(rawVal, ety, path)
			if err != nil {
				return cty.NilVal, err
			}

			vals = append(vals, el)
		}
	}

	if err := requireDelim(dec, ']'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	if len(vals) != len(etys) {
		return cty.NilVal, path[:len(path)-1].NewErrorf("not enough tuple elements (need %d)", len(etys))
	}

	if len(vals) == 0 {
		return cty.EmptyTupleVal, nil
	}

	return cty.TupleVal(vals), nil
}

func unmarshalObject(buf []byte, atys map[string]cty.Type, path cty.Path) (cty.Value, error) {
	dec := bufDecoder(buf)
	if err := requireDelim(dec, '{'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	vals := make(map[string]cty.Value)

	{
		objPath := path           // some errors report from the object's perspective
		path := append(path, nil) // path to a specific attribute

		for dec.More() {

			var err error

			k, err := requireObjectKey(dec)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to read object key: %s", err)
			}

			aty, ok := atys[k]
			if !ok {
				return cty.NilVal, objPath.NewErrorf("unsupported attribute %q", k)
			}

			path[len(path)-1] = cty.GetAttrStep{
				Name: k,
			}

			rawVal, err := readRawValue(dec)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to read object value: %s", err)
			}

			el, err := unmarshal(rawVal, aty, path)
			if err != nil {
				return cty.NilVal, err
			}

			vals[k] = el
		}
	}

	if err := requireDelim(dec, '}'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	// Make sure we have a value for every attribute
	for k, aty := range atys {
		if _, exists := vals[k]; !exists {
			vals[k] = cty.NullVal(aty)
		}
	}

	if len(vals) == 0 {
		return cty.EmptyObjectVal, nil
	}

	return cty.ObjectVal(vals), nil
}

func unmarshalCapsule(buf []byte, t cty.Type, path cty.Path) (cty.Value, error) {
	rawType := t.EncapsulatedType()
	ptrPtr := reflect.New(reflect.PtrTo(rawType))
	ptrPtr.Elem().Set(reflect.New(rawType))
	ptr := ptrPtr.Elem().Interface()
	err := json.Unmarshal(buf, ptr)
	if err != nil {
		return cty.NilVal, path.NewError(err)
	}

	return cty.CapsuleVal(t, ptr), nil
}

func unmarshalDynamic(buf []byte, path cty.Path) (cty.Value, error) {
	dec := bufDecoder(buf)
	if err := requireDelim(dec, '{'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	var t cty.Type
	var valBody []byte // defer actual decoding until we know the type

	for dec.More() {
		var err error

		key, err := requireObjectKey(dec)
		if err != nil {
			return cty.NilVal, path.NewErrorf("failed to read dynamic type descriptor key: %s", err)
		}

		rawVal, err := readRawValue(dec)
		if err != nil {
			return cty.NilVal, path.NewErrorf("failed to read dynamic type descriptor value: %s", err)
		}

		switch key {
		case "type":
			err := json.Unmarshal(rawVal, &t)
			if err != nil {
				return cty.NilVal, path.NewErrorf("failed to decode type for dynamic value: %s", err)
			}
		case "value":
			valBody = rawVal
		default:
			return cty.NilVal, path.NewErrorf("invalid key %q in dynamically-typed value", key)
		}

	}

	if err := requireDelim(dec, '}'); err != nil {
		return cty.NilVal, path.NewError(err)
	}

	if t == cty.NilType {
		return cty.NilVal, path.NewErrorf("missing type in dynamically-typed value")
	}
	if valBody == nil {
		return cty.NilVal, path.NewErrorf("missing value in dynamically-typed value")
	}

	val, err := Unmarshal([]byte(valBody), t)
	if err != nil {
		return cty.NilVal, path.NewError(err)
	}
	return val, nil
}

func requireDelim(dec *json.Decoder, d rune) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}

	if tok != json.Delim(d) {
		return fmt.Errorf("missing expected %c", d)
	}

	return nil
}

func requireObjectKey(dec *json.Decoder) (string, error) {
	tok, err := dec.Token()
	if err != nil {
		return "", err
	}
	if s, ok := tok.(string); ok {
		return s, nil
	}
	return "", fmt.Errorf("missing expected object key")
}

func readRawValue(dec *json.Decoder) ([]byte, error) {
	var rawVal json.RawMessage
	err := dec.Decode(&rawVal)
	if err != nil {
		return nil, err
	}
	return []byte(rawVal), nil
}

func bufDecoder(buf []byte) *json.Decoder {
	r := bytes.NewReader(buf)
	dec := json.NewDecoder(r)
	dec.UseNumber()
	return dec
}
