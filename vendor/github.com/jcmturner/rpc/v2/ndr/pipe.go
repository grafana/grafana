package ndr

import (
	"fmt"
	"reflect"
)

func (dec *Decoder) fillPipe(v reflect.Value, tag reflect.StructTag) error {
	s, err := dec.readUint32() // read element count of first chunk
	if err != nil {
		return err
	}
	a := reflect.MakeSlice(v.Type(), 0, 0)
	c := reflect.MakeSlice(v.Type(), int(s), int(s))
	for s != 0 {
		for i := 0; i < int(s); i++ {
			err := dec.fill(c.Index(i), tag, &[]deferedPtr{})
			if err != nil {
				return fmt.Errorf("could not fill element %d of pipe: %v", i, err)
			}
		}
		s, err = dec.readUint32() // read element count of first chunk
		if err != nil {
			return err
		}
		a = reflect.AppendSlice(a, c)
		c = reflect.MakeSlice(v.Type(), int(s), int(s))
	}
	v.Set(a)
	return nil
}
