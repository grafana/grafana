package cty

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
)

// MarshalJSON is an implementation of json.Marshaler that allows Type
// instances to be serialized as JSON.
//
// All standard types can be serialized, but capsule types cannot since there
// is no way to automatically recover the original pointer and capsule types
// compare by equality.
func (t Type) MarshalJSON() ([]byte, error) {
	switch impl := t.typeImpl.(type) {
	case primitiveType:
		switch impl.Kind {
		case primitiveTypeBool:
			return []byte{'"', 'b', 'o', 'o', 'l', '"'}, nil
		case primitiveTypeNumber:
			return []byte{'"', 'n', 'u', 'm', 'b', 'e', 'r', '"'}, nil
		case primitiveTypeString:
			return []byte{'"', 's', 't', 'r', 'i', 'n', 'g', '"'}, nil
		default:
			panic("unknown primitive type kind")
		}
	case typeList, typeMap, typeSet:
		buf := &bytes.Buffer{}
		etyJSON, err := t.ElementType().MarshalJSON()
		if err != nil {
			return nil, err
		}
		buf.WriteRune('[')
		switch impl.(type) {
		case typeList:
			buf.WriteString(`"list"`)
		case typeMap:
			buf.WriteString(`"map"`)
		case typeSet:
			buf.WriteString(`"set"`)
		}
		buf.WriteRune(',')
		buf.Write(etyJSON)
		buf.WriteRune(']')
		return buf.Bytes(), nil
	case typeObject:
		buf := &bytes.Buffer{}
		atysJSON, err := json.Marshal(t.AttributeTypes())
		if err != nil {
			return nil, err
		}
		buf.WriteString(`["object",`)
		buf.Write(atysJSON)
		if optionals := t.OptionalAttributes(); len(optionals) > 0 {
			buf.WriteByte(',')
			optionalNames := make([]string, 0, len(optionals))
			for k := range optionals {
				optionalNames = append(optionalNames, k)
			}
			sort.Strings(optionalNames)
			optionalsJSON, err := json.Marshal(optionalNames)
			if err != nil {
				return nil, err
			}
			buf.Write(optionalsJSON)
		}
		buf.WriteRune(']')
		return buf.Bytes(), nil
	case typeTuple:
		buf := &bytes.Buffer{}
		etysJSON, err := json.Marshal(t.TupleElementTypes())
		if err != nil {
			return nil, err
		}
		buf.WriteString(`["tuple",`)
		buf.Write(etysJSON)
		buf.WriteRune(']')
		return buf.Bytes(), nil
	case pseudoTypeDynamic:
		return []byte{'"', 'd', 'y', 'n', 'a', 'm', 'i', 'c', '"'}, nil
	case *capsuleType:
		return nil, fmt.Errorf("type not allowed: %s", t.FriendlyName())
	default:
		// should never happen
		panic("unknown type implementation")
	}
}

// UnmarshalJSON is the opposite of MarshalJSON. See the documentation of
// MarshalJSON for information on the limitations of JSON serialization of
// types.
func (t *Type) UnmarshalJSON(buf []byte) error {
	r := bytes.NewReader(buf)
	dec := json.NewDecoder(r)

	tok, err := dec.Token()
	if err != nil {
		return err
	}

	switch v := tok.(type) {
	case string:
		switch v {
		case "bool":
			*t = Bool
		case "number":
			*t = Number
		case "string":
			*t = String
		case "dynamic":
			*t = DynamicPseudoType
		default:
			return fmt.Errorf("invalid primitive type name %q", v)
		}

		if dec.More() {
			return fmt.Errorf("extraneous data after type description")
		}
		return nil
	case json.Delim:
		if rune(v) != '[' {
			return fmt.Errorf("invalid complex type description")
		}

		tok, err = dec.Token()
		if err != nil {
			return err
		}

		kind, ok := tok.(string)
		if !ok {
			return fmt.Errorf("invalid complex type kind name")
		}

		switch kind {
		case "list":
			var ety Type
			err = dec.Decode(&ety)
			if err != nil {
				return err
			}
			*t = List(ety)
		case "map":
			var ety Type
			err = dec.Decode(&ety)
			if err != nil {
				return err
			}
			*t = Map(ety)
		case "set":
			var ety Type
			err = dec.Decode(&ety)
			if err != nil {
				return err
			}
			*t = Set(ety)
		case "object":
			var atys map[string]Type
			err = dec.Decode(&atys)
			if err != nil {
				return err
			}
			if dec.More() {
				var optionals []string
				err = dec.Decode(&optionals)
				if err != nil {
					return err
				}
				*t = ObjectWithOptionalAttrs(atys, optionals)
			} else {
				*t = Object(atys)
			}
		case "tuple":
			var etys []Type
			err = dec.Decode(&etys)
			if err != nil {
				return err
			}
			*t = Tuple(etys)
		default:
			return fmt.Errorf("invalid complex type kind name")
		}

		tok, err = dec.Token()
		if err != nil {
			return err
		}
		if delim, ok := tok.(json.Delim); !ok || rune(delim) != ']' || dec.More() {
			return fmt.Errorf("unexpected extra data in type description")
		}

		return nil

	default:
		return fmt.Errorf("invalid type description")
	}
}
