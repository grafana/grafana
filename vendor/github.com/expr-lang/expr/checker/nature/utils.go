package nature

import (
	"reflect"

	"github.com/expr-lang/expr/internal/deref"
)

func fieldName(fieldName string, tag reflect.StructTag) (string, bool) {
	switch taggedName := tag.Get("expr"); taggedName {
	case "-":
		return "", false
	case "":
		return fieldName, true
	default:
		return taggedName, true
	}
}

type structData struct {
	rType                     reflect.Type
	fields                    map[string]*structField
	numField, ownIdx, anonIdx int

	curParent, curChild *structData
	curChildIndex       []int
}

type structField struct {
	Nature
	Index []int
}

func (s *structData) finished() bool {
	return s.ownIdx >= s.numField && // no own fields left to visit
		s.anonIdx >= s.numField && // no embedded fields to visit
		s.curChild == nil // no child in process of visiting
}

func (s *structData) structField(c *Cache, parentEmbed *structData, name string) *structField {
	if s.fields == nil {
		if s.numField > 0 {
			s.fields = make(map[string]*structField, s.numField)
		}
	} else if f := s.fields[name]; f != nil {
		return f
	}
	if s.finished() {
		return nil
	}

	// Lookup own fields first.
	for ; s.ownIdx < s.numField; s.ownIdx++ {
		field := s.rType.Field(s.ownIdx)
		if field.Anonymous && s.anonIdx < 0 {
			// start iterating anon fields on the first instead of zero
			s.anonIdx = s.ownIdx
		}
		if !field.IsExported() {
			continue
		}
		fName, ok := fieldName(field.Name, field.Tag)
		if !ok || fName == "" {
			// name can still be empty for a type created at runtime with
			// reflect
			continue
		}
		nt := c.FromType(field.Type)
		sf := &structField{
			Nature: nt,
			Index:  field.Index,
		}
		s.fields[fName] = sf
		if parentEmbed != nil {
			parentEmbed.trySet(fName, sf)
		}
		if fName == name {
			return sf
		}
	}

	if s.curChild != nil {
		sf := s.findInEmbedded(c, parentEmbed, s.curChild, s.curChildIndex, name)
		if sf != nil {
			return sf
		}
	}

	// Lookup embedded fields through anon own fields
	for ; s.anonIdx >= 0 && s.anonIdx < s.numField; s.anonIdx++ {
		field := s.rType.Field(s.anonIdx)
		// we do enter embedded non-exported types because they could contain
		// exported fields
		if !field.Anonymous {
			continue
		}
		t, k, _ := deref.TypeKind(field.Type, field.Type.Kind())
		if k != reflect.Struct {
			continue
		}

		childEmbed := c.getStruct(t).structData
		sf := s.findInEmbedded(c, parentEmbed, childEmbed, field.Index, name)
		if sf != nil {
			return sf
		}
	}

	return nil
}

func (s *structData) findInEmbedded(
	c *Cache,
	parentEmbed, childEmbed *structData,
	childIndex []int,
	name string,
) *structField {
	// Set current parent/child data. This allows trySet to handle child fields
	// and add them to our struct and to the parent as well if needed
	s.curParent = parentEmbed
	s.curChild = childEmbed
	s.curChildIndex = childIndex
	defer func() {
		// Ensure to cleanup references
		s.curParent = nil
		if childEmbed.finished() {
			// If the child can still have more fields to explore then keep it
			// referened to look it up again if we need to
			s.curChild = nil
			s.curChildIndex = nil
		}
	}()

	// See if the child has already cached its fields. This is still important
	// to check even if it's the s.unfinishedEmbedded because it may have
	// explored new fields since the last time we visited it
	for name, sf := range childEmbed.fields {
		s.trySet(name, sf)
	}

	// Recheck if we have what we needed from the above sync
	if sf := s.fields[name]; sf != nil {
		return sf
	}

	// Try finding in the child again in case it hasn't finished
	if !childEmbed.finished() {
		if childEmbed.structField(c, s, name) != nil {
			return s.fields[name]
		}
	}

	return nil
}

func (s *structData) trySet(name string, sf *structField) {
	if _, ok := s.fields[name]; ok {
		return
	}
	sf = &structField{
		Nature: sf.Nature,
		Index:  append(s.curChildIndex, sf.Index...),
	}
	s.fields[name] = sf
	if s.curParent != nil {
		s.curParent.trySet(name, sf)
	}
}

func StructFields(c *Cache, t reflect.Type) map[string]Nature {
	table := make(map[string]Nature)
	if t == nil {
		return table
	}
	t, k, _ := deref.TypeKind(t, t.Kind())
	if k == reflect.Struct {
		// lookup for a field with an empty name, which will cause to never find a
		// match, meaning everything will have been cached.
		sd := c.getStruct(t).structData
		sd.structField(c, nil, "")
		for name, sf := range sd.fields {
			table[name] = sf.Nature
		}
	}
	return table
}

type methodset struct {
	rType          reflect.Type
	kind           reflect.Kind
	methods        map[string]*method
	numMethod, idx int
}

type method struct {
	reflect.Method
	nature Nature
}

func (s *methodset) method(c *Cache, name string) *method {
	if s.methods == nil {
		s.methods = make(map[string]*method, s.numMethod)
	} else if m := s.methods[name]; m != nil {
		return m
	}
	for ; s.idx < s.numMethod; s.idx++ {
		rm := s.rType.Method(s.idx)
		if !rm.IsExported() {
			continue
		}
		nt := c.FromType(rm.Type)
		if s.rType.Kind() != reflect.Interface {
			nt.Method = true
			nt.MethodIndex = rm.Index
			// In case of interface type method will not have a receiver,
			// and to prevent checker decreasing numbers of in arguments
			// return method type as not method (second argument is false).

			// Also, we can not use m.Index here, because it will be
			// different indexes for different types which implement
			// the same interface.
		}
		m := &method{
			Method: rm,
			nature: nt,
		}
		s.methods[rm.Name] = m
		if rm.Name == name {
			return m
		}
	}
	return nil
}
