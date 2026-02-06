package gojsondiff

import (
	"encoding/json"
	"errors"
	dmp "github.com/sergi/go-diff/diffmatchpatch"
	"io"
	"strconv"
)

type Unmarshaller struct {
}

func NewUnmarshaller() *Unmarshaller {
	return &Unmarshaller{}
}

func (um *Unmarshaller) UnmarshalBytes(diffBytes []byte) (Diff, error) {
	var diffObj map[string]interface{}
	json.Unmarshal(diffBytes, &diffObj)
	return um.UnmarshalObject(diffObj)
}

func (um *Unmarshaller) UnmarshalString(diffString string) (Diff, error) {
	return um.UnmarshalBytes([]byte(diffString))
}

func (um *Unmarshaller) UnmarshalReader(diffReader io.Reader) (Diff, error) {
	var diffBytes []byte
	io.ReadFull(diffReader, diffBytes)
	return um.UnmarshalBytes(diffBytes)
}

func (um *Unmarshaller) UnmarshalObject(diffObj map[string]interface{}) (Diff, error) {
	result, err := process(Name(""), diffObj)
	if err != nil {
		return nil, err
	}
	return &diff{deltas: result.(*Object).Deltas}, nil
}

func process(position Position, object interface{}) (Delta, error) {
	var delta Delta
	switch object.(type) {
	case map[string]interface{}:
		o := object.(map[string]interface{})
		if isArray, typed := o["_t"]; typed && isArray == "a" {
			deltas := make([]Delta, 0, len(o))
			for name, value := range o {
				if name == "_t" {
					continue
				}

				normalizedName := name
				if normalizedName[0] == '_' {
					normalizedName = name[1:]
				}
				index, err := strconv.Atoi(normalizedName)
				if err != nil {
					return nil, err
				}

				childDelta, err := process(Index(index), value)
				if err != nil {
					return nil, err
				}

				deltas = append(deltas, childDelta)
			}

			for _, d := range deltas {
				switch d.(type) {
				case *Moved:
					moved := d.(*Moved)

					var dd interface{}
					var i int
					for i, dd = range deltas {
						switch dd.(type) {
						case *Moved:
						case PostDelta:
							pd := dd.(PostDelta)
							if moved.PostPosition() == pd.PostPosition() {
								moved.Delta = pd
								deltas = append(deltas[:i], deltas[i+1:]...)
							}
						}
					}
				}
			}

			delta = NewArray(position, deltas)
		} else {
			deltas := make([]Delta, 0, len(o))
			for name, value := range o {
				childDelta, err := process(Name(name), value)
				if err != nil {
					return nil, err
				}
				deltas = append(deltas, childDelta)
			}
			delta = NewObject(position, deltas)
		}
	case []interface{}:
		o := object.([]interface{})
		switch len(o) {
		case 1:
			delta = NewAdded(position, o[0])
		case 2:
			delta = NewModified(position, o[0], o[1])
		case 3:
			switch o[2] {
			case float64(0):
				delta = NewDeleted(position, o[0])
			case float64(2):
				dmp := dmp.New()
				patches, err := dmp.PatchFromText(o[0].(string))
				if err != nil {
					return nil, err
				}
				delta = NewTextDiff(position, patches, nil, nil)
			case float64(3):
				delta = NewMoved(position, Index(int(o[1].(float64))), nil, nil)
			default:
				return nil, errors.New("Unknown delta type")
			}
		}
	}

	return delta, nil
}
