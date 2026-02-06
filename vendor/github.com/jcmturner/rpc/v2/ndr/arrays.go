package ndr

import (
	"errors"
	"fmt"
	"reflect"
	"strconv"
)

// intFromTag returns an int that is a value in a struct tag key/value pair
func intFromTag(tag reflect.StructTag, key string) (int, error) {
	ndrTag := parseTags(tag)
	d := 1
	if n, ok := ndrTag.Map[key]; ok {
		i, err := strconv.Atoi(n)
		if err != nil {
			return d, fmt.Errorf("invalid dimensions tag [%s]: %v", n, err)
		}
		d = i
	}
	return d, nil
}

// parseDimensions returns the a slice of the size of each dimension and type of the member at the deepest level.
func parseDimensions(v reflect.Value) (l []int, tb reflect.Type) {
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	t := v.Type()
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Array && t.Kind() != reflect.Slice {
		return
	}
	l = append(l, v.Len())
	if t.Elem().Kind() == reflect.Array || t.Elem().Kind() == reflect.Slice {
		// contains array or slice
		var m []int
		m, tb = parseDimensions(v.Index(0))
		l = append(l, m...)
	} else {
		tb = t.Elem()
	}
	return
}

// sliceDimensions returns the count of dimensions a slice has.
func sliceDimensions(t reflect.Type) (d int, tb reflect.Type) {
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() == reflect.Slice {
		d++
		var n int
		n, tb = sliceDimensions(t.Elem())
		d += n
	} else {
		tb = t
	}
	return
}

// makeSubSlices is a deep recursive creation/initialisation of multi-dimensional slices.
// Takes the reflect.Value of the 1st dimension and a slice of the lengths of the sub dimensions
func makeSubSlices(v reflect.Value, l []int) {
	ty := v.Type().Elem()
	if ty.Kind() != reflect.Slice {
		return
	}
	for i := 0; i < v.Len(); i++ {
		s := reflect.MakeSlice(ty, l[0], l[0])
		v.Index(i).Set(s)
		// Are there more sub dimensions?
		if len(l) > 1 {
			makeSubSlices(v.Index(i), l[1:])
		}
	}
	return
}

// multiDimensionalIndexPermutations returns all the permutations of the indexes of a multi-dimensional slice.
// The input is a slice of integers that indicates the max size/length of each dimension
func multiDimensionalIndexPermutations(l []int) (ps [][]int) {
	z := make([]int, len(l), len(l)) // The zeros permutation
	ps = append(ps, z)
	// for each dimension, in reverse
	for i := len(l) - 1; i >= 0; i-- {
		ws := make([][]int, len(ps))
		copy(ws, ps)
		//create a permutation for each of the iterations of the current dimension
		for j := 1; j <= l[i]-1; j++ {
			// For each existing permutation
			for _, p := range ws {
				np := make([]int, len(p), len(p))
				copy(np, p)
				np[i] = j
				ps = append(ps, np)
			}
		}
	}
	return
}

// precedingMax reads off the next conformant max value
func (dec *Decoder) precedingMax() uint32 {
	m := dec.conformantMax[0]
	dec.conformantMax = dec.conformantMax[1:]
	return m
}

// fillFixedArray establishes if the fixed array is uni or multi dimensional and then fills it.
func (dec *Decoder) fillFixedArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	l, t := parseDimensions(v)
	if t.Kind() == reflect.String {
		tag = reflect.StructTag(subStringArrayTag)
	}
	if len(l) < 1 {
		return errors.New("could not establish dimensions of fixed array")
	}
	if len(l) == 1 {
		err := dec.fillUniDimensionalFixedArray(v, tag, def)
		if err != nil {
			return fmt.Errorf("could not fill uni-dimensional fixed array: %v", err)
		}
		return nil
	}
	// Fixed array is multidimensional
	ps := multiDimensionalIndexPermutations(l[:len(l)-1])
	for _, p := range ps {
		// Get current multi-dimensional index to fill
		a := v
		for _, i := range p {
			a = a.Index(i)
		}
		// fill with the last dimension array
		err := dec.fillUniDimensionalFixedArray(a, tag, def)
		if err != nil {
			return fmt.Errorf("could not fill dimension %v of multi-dimensional fixed array: %v", p, err)
		}
	}
	return nil
}

// readUniDimensionalFixedArray reads an array (not slice) from the byte stream.
func (dec *Decoder) fillUniDimensionalFixedArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	for i := 0; i < v.Len(); i++ {
		err := dec.fill(v.Index(i), tag, def)
		if err != nil {
			return fmt.Errorf("could not fill index %d of fixed array: %v", i, err)
		}
	}
	return nil
}

// fillConformantArray establishes if the conformant array is uni or multi dimensional and then fills the slice.
func (dec *Decoder) fillConformantArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	d, _ := sliceDimensions(v.Type())
	if d > 1 {
		err := dec.fillMultiDimensionalConformantArray(v, d, tag, def)
		if err != nil {
			return err
		}
	} else {
		err := dec.fillUniDimensionalConformantArray(v, tag, def)
		if err != nil {
			return err
		}
	}
	return nil
}

// fillUniDimensionalConformantArray fills the uni-dimensional slice value.
func (dec *Decoder) fillUniDimensionalConformantArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	m := dec.precedingMax()
	n := int(m)
	a := reflect.MakeSlice(v.Type(), n, n)
	for i := 0; i < n; i++ {
		err := dec.fill(a.Index(i), tag, def)
		if err != nil {
			return fmt.Errorf("could not fill index %d of uni-dimensional conformant array: %v", i, err)
		}
	}
	v.Set(a)
	return nil
}

// fillMultiDimensionalConformantArray fills the multi-dimensional slice value provided from conformant array data.
// The number of dimensions must be specified. This must be less than or equal to the dimensions in the slice for this
// method not to panic.
func (dec *Decoder) fillMultiDimensionalConformantArray(v reflect.Value, d int, tag reflect.StructTag, def *[]deferedPtr) error {
	// Read the max size of each dimensions from the ndr stream
	l := make([]int, d, d)
	for i := range l {
		l[i] = int(dec.precedingMax())
	}
	// Initialise size of slices
	//   Initialise the size of the 1st dimension
	ty := v.Type()
	v.Set(reflect.MakeSlice(ty, l[0], l[0]))
	// Initialise the size of the other dimensions recursively
	makeSubSlices(v, l[1:])

	// Get all permutations of the indexes and go through each and fill
	ps := multiDimensionalIndexPermutations(l)
	for _, p := range ps {
		// Get current multi-dimensional index to fill
		a := v
		for _, i := range p {
			a = a.Index(i)
		}
		err := dec.fill(a, tag, def)
		if err != nil {
			return fmt.Errorf("could not fill index %v of slice: %v", p, err)
		}
	}
	return nil
}

// fillVaryingArray establishes if the varying array is uni or multi dimensional and then fills the slice.
func (dec *Decoder) fillVaryingArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	d, t := sliceDimensions(v.Type())
	if d > 1 {
		err := dec.fillMultiDimensionalVaryingArray(v, t, d, tag, def)
		if err != nil {
			return err
		}
	} else {
		err := dec.fillUniDimensionalVaryingArray(v, tag, def)
		if err != nil {
			return err
		}
	}
	return nil
}

// fillUniDimensionalVaryingArray fills the uni-dimensional slice value.
func (dec *Decoder) fillUniDimensionalVaryingArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	o, err := dec.readUint32()
	if err != nil {
		return fmt.Errorf("could not read offset of uni-dimensional varying array: %v", err)
	}
	s, err := dec.readUint32()
	if err != nil {
		return fmt.Errorf("could not establish actual count of uni-dimensional varying array: %v", err)
	}
	t := v.Type()
	// Total size of the array is the offset in the index being passed plus the actual count of elements being passed.
	n := int(s + o)
	a := reflect.MakeSlice(t, n, n)
	// Populate the array starting at the offset specified
	for i := int(o); i < n; i++ {
		err := dec.fill(a.Index(i), tag, def)
		if err != nil {
			return fmt.Errorf("could not fill index %d of uni-dimensional varying array: %v", i, err)
		}
	}
	v.Set(a)
	return nil
}

// fillMultiDimensionalVaryingArray fills the multi-dimensional slice value provided from varying array data.
// The number of dimensions must be specified. This must be less than or equal to the dimensions in the slice for this
// method not to panic.
func (dec *Decoder) fillMultiDimensionalVaryingArray(v reflect.Value, t reflect.Type, d int, tag reflect.StructTag, def *[]deferedPtr) error {
	// Read the offset and actual count of each dimensions from the ndr stream
	o := make([]int, d, d)
	l := make([]int, d, d)
	for i := range l {
		off, err := dec.readUint32()
		if err != nil {
			return fmt.Errorf("could not read offset of dimension %d: %v", i+1, err)
		}
		o[i] = int(off)
		s, err := dec.readUint32()
		if err != nil {
			return fmt.Errorf("could not read size of dimension %d: %v", i+1, err)
		}
		l[i] = int(s) + int(off)
	}
	// Initialise size of slices
	//   Initialise the size of the 1st dimension
	ty := v.Type()
	v.Set(reflect.MakeSlice(ty, l[0], l[0]))
	// Initialise the size of the other dimensions recursively
	makeSubSlices(v, l[1:])

	// Get all permutations of the indexes and go through each and fill
	ps := multiDimensionalIndexPermutations(l)
	for _, p := range ps {
		// Get current multi-dimensional index to fill
		a := v
		var os bool // should this permutation be skipped due to the offset of any of the dimensions?
		for i, j := range p {
			if j < o[i] {
				os = true
				break
			}
			a = a.Index(j)
		}
		if os {
			// This permutation should be skipped as it is less than the offset for one of the dimensions.
			continue
		}
		err := dec.fill(a, tag, def)
		if err != nil {
			return fmt.Errorf("could not fill index %v of slice: %v", p, err)
		}
	}
	return nil
}

// fillConformantVaryingArray establishes if the varying array is uni or multi dimensional and then fills the slice.
func (dec *Decoder) fillConformantVaryingArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	d, t := sliceDimensions(v.Type())
	if d > 1 {
		err := dec.fillMultiDimensionalConformantVaryingArray(v, t, d, tag, def)
		if err != nil {
			return err
		}
	} else {
		err := dec.fillUniDimensionalConformantVaryingArray(v, tag, def)
		if err != nil {
			return err
		}
	}
	return nil
}

// fillUniDimensionalConformantVaryingArray fills the uni-dimensional slice value.
func (dec *Decoder) fillUniDimensionalConformantVaryingArray(v reflect.Value, tag reflect.StructTag, def *[]deferedPtr) error {
	m := dec.precedingMax()
	o, err := dec.readUint32()
	if err != nil {
		return fmt.Errorf("could not read offset of uni-dimensional conformant varying array: %v", err)
	}
	s, err := dec.readUint32()
	if err != nil {
		return fmt.Errorf("could not establish actual count of uni-dimensional conformant varying array: %v", err)
	}
	if m < o+s {
		return errors.New("max count is less than the offset plus actual count")
	}
	t := v.Type()
	n := int(s)
	a := reflect.MakeSlice(t, n, n)
	for i := int(o); i < n; i++ {
		err := dec.fill(a.Index(i), tag, def)
		if err != nil {
			return fmt.Errorf("could not fill index %d of uni-dimensional conformant varying array: %v", i, err)
		}
	}
	v.Set(a)
	return nil
}

// fillMultiDimensionalConformantVaryingArray fills the multi-dimensional slice value provided from conformant varying array data.
// The number of dimensions must be specified. This must be less than or equal to the dimensions in the slice for this
// method not to panic.
func (dec *Decoder) fillMultiDimensionalConformantVaryingArray(v reflect.Value, t reflect.Type, d int, tag reflect.StructTag, def *[]deferedPtr) error {
	// Read the offset and actual count of each dimensions from the ndr stream
	m := make([]int, d, d)
	for i := range m {
		m[i] = int(dec.precedingMax())
	}
	o := make([]int, d, d)
	l := make([]int, d, d)
	for i := range l {
		off, err := dec.readUint32()
		if err != nil {
			return fmt.Errorf("could not read offset of dimension %d: %v", i+1, err)
		}
		o[i] = int(off)
		s, err := dec.readUint32()
		if err != nil {
			return fmt.Errorf("could not read actual count of dimension %d: %v", i+1, err)
		}
		if m[i] < int(s)+int(off) {
			m[i] = int(s) + int(off)
		}
		l[i] = int(s)
	}
	// Initialise size of slices
	//   Initialise the size of the 1st dimension
	ty := v.Type()
	v.Set(reflect.MakeSlice(ty, m[0], m[0]))
	// Initialise the size of the other dimensions recursively
	makeSubSlices(v, m[1:])

	// Get all permutations of the indexes and go through each and fill
	ps := multiDimensionalIndexPermutations(m)
	for _, p := range ps {
		// Get current multi-dimensional index to fill
		a := v
		var os bool // should this permutation be skipped due to the offset of any of the dimensions or max is higher than the actual count being passed
		for i, j := range p {
			if j < o[i] || j >= l[i] {
				os = true
				break
			}
			a = a.Index(j)
		}
		if os {
			// This permutation should be skipped as it is less than the offset for one of the dimensions.
			continue
		}
		err := dec.fill(a, tag, def)
		if err != nil {
			return fmt.Errorf("could not fill index %v of slice: %v", p, err)
		}
	}
	return nil
}
