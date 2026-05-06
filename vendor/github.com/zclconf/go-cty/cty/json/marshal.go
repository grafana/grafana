package json

import (
	"bytes"
	"encoding/json"
	"sort"

	"github.com/zclconf/go-cty/cty"
)

func marshal(val cty.Value, t cty.Type, path cty.Path, b *bytes.Buffer) error {
	if val.IsMarked() {
		return path.NewErrorf("value has marks, so it cannot be serialized as JSON")
	}

	// If we're going to decode as DynamicPseudoType then we need to save
	// dynamic type information to recover the real type.
	if t == cty.DynamicPseudoType && val.Type() != cty.DynamicPseudoType {
		return marshalDynamic(val, path, b)
	}

	if val.IsNull() {
		b.WriteString("null")
		return nil
	}

	if !val.IsKnown() {
		return path.NewErrorf("value is not known")
	}

	// The caller should've guaranteed that the given val is conformant with
	// the given type t, so we'll proceed under that assumption here.

	switch {
	case t.IsPrimitiveType():
		switch t {
		case cty.String:
			json, err := json.Marshal(val.AsString())
			if err != nil {
				return path.NewErrorf("failed to serialize value: %s", err)
			}
			b.Write(json)
			return nil
		case cty.Number:
			if val.RawEquals(cty.PositiveInfinity) || val.RawEquals(cty.NegativeInfinity) {
				return path.NewErrorf("cannot serialize infinity as JSON")
			}
			b.WriteString(val.AsBigFloat().Text('f', -1))
			return nil
		case cty.Bool:
			if val.True() {
				b.WriteString("true")
			} else {
				b.WriteString("false")
			}
			return nil
		default:
			panic("unsupported primitive type")
		}
	case t.IsListType(), t.IsSetType():
		b.WriteRune('[')
		first := true
		ety := t.ElementType()
		it := val.ElementIterator()
		path := append(path, nil) // local override of 'path' with extra element
		for it.Next() {
			if !first {
				b.WriteRune(',')
			}
			ek, ev := it.Element()
			path[len(path)-1] = cty.IndexStep{
				Key: ek,
			}
			err := marshal(ev, ety, path, b)
			if err != nil {
				return err
			}
			first = false
		}
		b.WriteRune(']')
		return nil
	case t.IsMapType():
		b.WriteRune('{')
		first := true
		ety := t.ElementType()
		it := val.ElementIterator()
		path := append(path, nil) // local override of 'path' with extra element
		for it.Next() {
			if !first {
				b.WriteRune(',')
			}
			ek, ev := it.Element()
			path[len(path)-1] = cty.IndexStep{
				Key: ek,
			}
			var err error
			err = marshal(ek, ek.Type(), path, b)
			if err != nil {
				return err
			}
			b.WriteRune(':')
			err = marshal(ev, ety, path, b)
			if err != nil {
				return err
			}
			first = false
		}
		b.WriteRune('}')
		return nil
	case t.IsTupleType():
		b.WriteRune('[')
		etys := t.TupleElementTypes()
		it := val.ElementIterator()
		path := append(path, nil) // local override of 'path' with extra element
		i := 0
		for it.Next() {
			if i > 0 {
				b.WriteRune(',')
			}
			ety := etys[i]
			ek, ev := it.Element()
			path[len(path)-1] = cty.IndexStep{
				Key: ek,
			}
			err := marshal(ev, ety, path, b)
			if err != nil {
				return err
			}
			i++
		}
		b.WriteRune(']')
		return nil
	case t.IsObjectType():
		b.WriteRune('{')
		atys := t.AttributeTypes()
		path := append(path, nil) // local override of 'path' with extra element

		names := make([]string, 0, len(atys))
		for k := range atys {
			names = append(names, k)
		}
		sort.Strings(names)

		for i, k := range names {
			aty := atys[k]
			if i > 0 {
				b.WriteRune(',')
			}
			av := val.GetAttr(k)
			path[len(path)-1] = cty.GetAttrStep{
				Name: k,
			}
			var err error
			err = marshal(cty.StringVal(k), cty.String, path, b)
			if err != nil {
				return err
			}
			b.WriteRune(':')
			err = marshal(av, aty, path, b)
			if err != nil {
				return err
			}
		}
		b.WriteRune('}')
		return nil
	case t.IsCapsuleType():
		rawVal := val.EncapsulatedValue()
		jsonVal, err := json.Marshal(rawVal)
		if err != nil {
			return path.NewError(err)
		}
		b.Write(jsonVal)
		return nil
	default:
		// should never happen
		return path.NewErrorf("cannot JSON-serialize %s", t.FriendlyName())
	}
}

// marshalDynamic adds an extra wrapping object containing dynamic type
// information for the given value.
func marshalDynamic(val cty.Value, path cty.Path, b *bytes.Buffer) error {
	typeJSON, err := MarshalType(val.Type())
	if err != nil {
		return path.NewErrorf("failed to serialize type: %s", err)
	}
	b.WriteString(`{"value":`)
	marshal(val, val.Type(), path, b)
	b.WriteString(`,"type":`)
	b.Write(typeJSON)
	b.WriteRune('}')
	return nil
}
