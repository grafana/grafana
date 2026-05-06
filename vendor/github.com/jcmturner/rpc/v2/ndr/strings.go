package ndr

import (
	"fmt"
	"reflect"
)

const (
	subStringArrayTag   = `ndr:"varying,X-subStringArray"`
	subStringArrayValue = "X-subStringArray"
)

func uint16SliceToString(a []uint16) string {
	s := make([]rune, len(a), len(a))
	for i := range s {
		s[i] = rune(a[i])
	}
	if len(s) > 0 {
		// Remove any null terminator
		if s[len(s)-1] == rune(0) {
			s = s[:len(s)-1]
		}
	}
	return string(s)
}

func (dec *Decoder) readVaryingString(def *[]deferedPtr) (string, error) {
	a := new([]uint16)
	v := reflect.ValueOf(a)
	var t reflect.StructTag
	err := dec.fillUniDimensionalVaryingArray(v.Elem(), t, def)
	if err != nil {
		return "", err
	}
	s := uint16SliceToString(*a)
	return s, nil
}

func (dec *Decoder) readConformantVaryingString(def *[]deferedPtr) (string, error) {
	a := new([]uint16)
	v := reflect.ValueOf(a)
	var t reflect.StructTag
	err := dec.fillUniDimensionalConformantVaryingArray(v.Elem(), t, def)
	if err != nil {
		return "", err
	}
	s := uint16SliceToString(*a)
	return s, nil
}

func (dec *Decoder) readStringsArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	d, _ := sliceDimensions(v.Type())
	ndrTag := parseTags(tag)
	var m []int
	//var ms int
	if ndrTag.HasValue(TagConformant) {
		for i := 0; i < d; i++ {
			m = append(m, int(dec.precedingMax()))
		}
		//common max size
		_ = dec.precedingMax()
		//ms = int(n)
	}
	tag = reflect.StructTag(subStringArrayTag)
	err := dec.fillVaryingArray(v, tag, def)
	if err != nil {
		return fmt.Errorf("could not read string array: %v", err)
	}
	return nil
}
