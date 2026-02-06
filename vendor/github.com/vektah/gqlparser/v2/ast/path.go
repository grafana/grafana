package ast

import (
	"bytes"
	"encoding/json"
	"fmt"
)

var _ json.Unmarshaler = (*Path)(nil)

type Path []PathElement

type PathElement interface {
	isPathElement()
}

var (
	_ PathElement = PathIndex(0)
	_ PathElement = PathName("")
)

func (path Path) String() string {
	if path == nil {
		return ""
	}
	var str bytes.Buffer
	for i, v := range path {
		switch v := v.(type) {
		case PathIndex:
			str.WriteString(fmt.Sprintf("[%d]", v))
		case PathName:
			if i != 0 {
				str.WriteByte('.')
			}
			str.WriteString(string(v))
		default:
			panic(fmt.Sprintf("unknown type: %T", v))
		}
	}
	return str.String()
}

func (path *Path) UnmarshalJSON(b []byte) error {
	var vs []interface{}
	err := json.Unmarshal(b, &vs)
	if err != nil {
		return err
	}

	*path = make([]PathElement, 0, len(vs))
	for _, v := range vs {
		switch v := v.(type) {
		case string:
			*path = append(*path, PathName(v))
		case int:
			*path = append(*path, PathIndex(v))
		case float64:
			*path = append(*path, PathIndex(int(v)))
		default:
			return fmt.Errorf("unknown path element type: %T", v)
		}
	}
	return nil
}

type PathIndex int

func (PathIndex) isPathElement() {}

type PathName string

func (PathName) isPathElement() {}
