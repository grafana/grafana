// Package ndr provides the ability to unmarshal NDR encoded byte steams into Go data structures
package ndr

import (
	"bufio"
	"fmt"
	"io"
	"reflect"
	"strings"
)

// Struct tag values
const (
	TagConformant = "conformant"
	TagVarying    = "varying"
	TagPointer    = "pointer"
	TagPipe       = "pipe"
)

// Decoder unmarshals NDR byte stream data into a Go struct representation
type Decoder struct {
	r             *bufio.Reader // source of the data
	size          int           // initial size of bytes in buffer
	ch            CommonHeader  // NDR common header
	ph            PrivateHeader // NDR private header
	conformantMax []uint32      // conformant max values that were moved to the beginning of the structure
	s             interface{}   // pointer to the structure being populated
	current       []string      // keeps track of the current field being populated
}

type deferedPtr struct {
	v   reflect.Value
	tag reflect.StructTag
}

// NewDecoder creates a new instance of a NDR Decoder.
func NewDecoder(r io.Reader) *Decoder {
	dec := new(Decoder)
	dec.r = bufio.NewReader(r)
	dec.r.Peek(int(commonHeaderBytes)) // For some reason an operation is needed on the buffer to initialise it so Buffered() != 0
	dec.size = dec.r.Buffered()
	return dec
}

// Decode unmarshals the NDR encoded bytes into the pointer of a struct provided.
func (dec *Decoder) Decode(s interface{}) error {
	dec.s = s
	err := dec.readCommonHeader()
	if err != nil {
		return err
	}
	err = dec.readPrivateHeader()
	if err != nil {
		return err
	}
	_, err = dec.r.Discard(4) //The next 4 bytes are an RPC unique pointer referent. We just skip these.
	if err != nil {
		return Errorf("unable to process byte stream: %v", err)
	}

	return dec.process(s, reflect.StructTag(""))
}

func (dec *Decoder) process(s interface{}, tag reflect.StructTag) error {
	// Scan for conformant fields as their max counts are moved to the beginning
	// http://pubs.opengroup.org/onlinepubs/9629399/chap14.htm#tagfcjh_37
	err := dec.scanConformantArrays(s, tag)
	if err != nil {
		return err
	}
	// Recursively fill the struct fields
	var localDef []deferedPtr
	err = dec.fill(s, tag, &localDef)
	if err != nil {
		return Errorf("could not decode: %v", err)
	}
	// Read any deferred referents associated with pointers
	for _, p := range localDef {
		err = dec.process(p.v, p.tag)
		if err != nil {
			return fmt.Errorf("could not decode deferred referent: %v", err)
		}
	}
	return nil
}

// scanConformantArrays scans the structure for embedded conformant fields and captures the maximum element counts for
// dimensions of the array that are moved to the beginning of the structure.
func (dec *Decoder) scanConformantArrays(s interface{}, tag reflect.StructTag) error {
	err := dec.conformantScan(s, tag)
	if err != nil {
		return fmt.Errorf("failed to scan for embedded conformant arrays: %v", err)
	}
	for i := range dec.conformantMax {
		dec.conformantMax[i], err = dec.readUint32()
		if err != nil {
			return fmt.Errorf("could not read preceding conformant max count index %d: %v", i, err)
		}
	}
	return nil
}

// conformantScan inspects the structure's fields for whether they are conformant.
func (dec *Decoder) conformantScan(s interface{}, tag reflect.StructTag) error {
	ndrTag := parseTags(tag)
	if ndrTag.HasValue(TagPointer) {
		return nil
	}
	v := getReflectValue(s)
	switch v.Kind() {
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			err := dec.conformantScan(v.Field(i), v.Type().Field(i).Tag)
			if err != nil {
				return err
			}
		}
	case reflect.String:
		if !ndrTag.HasValue(TagConformant) {
			break
		}
		dec.conformantMax = append(dec.conformantMax, uint32(0))
	case reflect.Slice:
		if !ndrTag.HasValue(TagConformant) {
			break
		}
		d, t := sliceDimensions(v.Type())
		for i := 0; i < d; i++ {
			dec.conformantMax = append(dec.conformantMax, uint32(0))
		}
		// For string arrays there is a common max for the strings within the array.
		if t.Kind() == reflect.String {
			dec.conformantMax = append(dec.conformantMax, uint32(0))
		}
	}
	return nil
}

func (dec *Decoder) isPointer(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) (bool, error) {
	// Pointer so defer filling the referent
	ndrTag := parseTags(tag)
	if ndrTag.HasValue(TagPointer) {
		p, err := dec.readUint32()
		if err != nil {
			return true, fmt.Errorf("could not read pointer: %v", err)
		}
		ndrTag.delete(TagPointer)
		if p != 0 {
			// if pointer is not zero add to the deferred items at end of stream
			*def = append(*def, deferedPtr{v, ndrTag.StructTag()})
		}
		return true, nil
	}
	return false, nil
}

func getReflectValue(s interface{}) (v reflect.Value) {
	if r, ok := s.(reflect.Value); ok {
		v = r
	} else {
		if reflect.ValueOf(s).Kind() == reflect.Ptr {
			v = reflect.ValueOf(s).Elem()
		}
	}
	return
}

// fill populates fields with values from the NDR byte stream.
func (dec *Decoder) fill(s interface{}, tag reflect.StructTag, localDef *[]deferedPtr) error {
	v := getReflectValue(s)

	//// Pointer so defer filling the referent
	ptr, err := dec.isPointer(v, tag, localDef)
	if err != nil {
		return fmt.Errorf("could not process struct field(%s): %v", strings.Join(dec.current, "/"), err)
	}
	if ptr {
		return nil
	}

	// Populate the value from the byte stream
	switch v.Kind() {
	case reflect.Struct:
		dec.current = append(dec.current, v.Type().Name()) //Track the current field being filled
		// in case struct is a union, track this and the selected union field for efficiency
		var unionTag reflect.Value
		var unionField string // field to fill if struct is a union
		// Go through each field in the struct and recursively fill
		for i := 0; i < v.NumField(); i++ {
			fieldName := v.Type().Field(i).Name
			dec.current = append(dec.current, fieldName) //Track the current field being filled
			//fmt.Fprintf(os.Stderr, "DEBUG Decoding: %s\n", strings.Join(dec.current, "/"))
			structTag := v.Type().Field(i).Tag
			ndrTag := parseTags(structTag)

			// Union handling
			if !unionTag.IsValid() {
				// Is this field a union tag?
				unionTag = dec.isUnion(v.Field(i), structTag)
			} else {
				// What is the selected field value of the union if we don't already know
				if unionField == "" {
					unionField, err = unionSelectedField(v, unionTag)
					if err != nil {
						return fmt.Errorf("could not determine selected union value field for %s with discriminat"+
							" tag %s: %v", v.Type().Name(), unionTag, err)
					}
				}
				if ndrTag.HasValue(TagUnionField) && fieldName != unionField {
					// is a union and this field has not been selected so will skip it.
					dec.current = dec.current[:len(dec.current)-1] //This field has been skipped so remove it from the current field tracker
					continue
				}
			}

			// Check if field is a pointer
			if v.Field(i).Type().Implements(reflect.TypeOf(new(RawBytes)).Elem()) &&
				v.Field(i).Type().Kind() == reflect.Slice && v.Field(i).Type().Elem().Kind() == reflect.Uint8 {
				//field is for rawbytes
				structTag, err = addSizeToTag(v, v.Field(i), structTag)
				if err != nil {
					return fmt.Errorf("could not get rawbytes field(%s) size: %v", strings.Join(dec.current, "/"), err)
				}
				ptr, err := dec.isPointer(v.Field(i), structTag, localDef)
				if err != nil {
					return fmt.Errorf("could not process struct field(%s): %v", strings.Join(dec.current, "/"), err)
				}
				if !ptr {
					err := dec.readRawBytes(v.Field(i), structTag)
					if err != nil {
						return fmt.Errorf("could not fill raw bytes struct field(%s): %v", strings.Join(dec.current, "/"), err)
					}
				}
			} else {
				err := dec.fill(v.Field(i), structTag, localDef)
				if err != nil {
					return fmt.Errorf("could not fill struct field(%s): %v", strings.Join(dec.current, "/"), err)
				}
			}
			dec.current = dec.current[:len(dec.current)-1] //This field has been filled so remove it from the current field tracker
		}
		dec.current = dec.current[:len(dec.current)-1] //This field has been filled so remove it from the current field tracker
	case reflect.Bool:
		i, err := dec.readBool()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Uint8:
		i, err := dec.readUint8()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Uint16:
		i, err := dec.readUint16()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Uint32:
		i, err := dec.readUint32()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Uint64:
		i, err := dec.readUint64()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Int8:
		i, err := dec.readInt8()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Int16:
		i, err := dec.readInt16()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Int32:
		i, err := dec.readInt32()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Int64:
		i, err := dec.readInt64()
		if err != nil {
			return fmt.Errorf("could not fill %s: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.String:
		ndrTag := parseTags(tag)
		conformant := ndrTag.HasValue(TagConformant)
		// strings are always varying so this is assumed without an explicit tag
		var s string
		var err error
		if conformant {
			s, err = dec.readConformantVaryingString(localDef)
			if err != nil {
				return fmt.Errorf("could not fill with conformant varying string: %v", err)
			}
		} else {
			s, err = dec.readVaryingString(localDef)
			if err != nil {
				return fmt.Errorf("could not fill with varying string: %v", err)
			}
		}
		v.Set(reflect.ValueOf(s))
	case reflect.Float32:
		i, err := dec.readFloat32()
		if err != nil {
			return fmt.Errorf("could not fill %v: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Float64:
		i, err := dec.readFloat64()
		if err != nil {
			return fmt.Errorf("could not fill %v: %v", v.Type().Name(), err)
		}
		v.Set(reflect.ValueOf(i))
	case reflect.Array:
		err := dec.fillFixedArray(v, tag, localDef)
		if err != nil {
			return err
		}
	case reflect.Slice:
		if v.Type().Implements(reflect.TypeOf(new(RawBytes)).Elem()) && v.Type().Elem().Kind() == reflect.Uint8 {
			//field is for rawbytes
			err := dec.readRawBytes(v, tag)
			if err != nil {
				return fmt.Errorf("could not fill raw bytes struct field(%s): %v", strings.Join(dec.current, "/"), err)
			}
			break
		}
		ndrTag := parseTags(tag)
		conformant := ndrTag.HasValue(TagConformant)
		varying := ndrTag.HasValue(TagVarying)
		if ndrTag.HasValue(TagPipe) {
			err := dec.fillPipe(v, tag)
			if err != nil {
				return err
			}
			break
		}
		_, t := sliceDimensions(v.Type())
		if t.Kind() == reflect.String && !ndrTag.HasValue(subStringArrayValue) {
			// String array
			err := dec.readStringsArray(v, tag, localDef)
			if err != nil {
				return err
			}
			break
		}
		// varying is assumed as fixed arrays use the Go array type rather than slice
		if conformant && varying {
			err := dec.fillConformantVaryingArray(v, tag, localDef)
			if err != nil {
				return err
			}
		} else if !conformant && varying {
			err := dec.fillVaryingArray(v, tag, localDef)
			if err != nil {
				return err
			}
		} else {
			//default to conformant and not varying
			err := dec.fillConformantArray(v, tag, localDef)
			if err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("unsupported type")
	}
	return nil
}

// readBytes returns a number of bytes from the NDR byte stream.
func (dec *Decoder) readBytes(n int) ([]byte, error) {
	//TODO make this take an int64 as input to allow for larger values on all systems?
	b := make([]byte, n, n)
	m, err := dec.r.Read(b)
	if err != nil || m != n {
		return b, fmt.Errorf("error reading bytes from stream: %v", err)
	}
	return b, nil
}
