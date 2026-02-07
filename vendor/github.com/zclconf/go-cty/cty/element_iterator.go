package cty

import (
	"sort"

	"github.com/zclconf/go-cty/cty/set"
)

// ElementIterator is the interface type returned by Value.ElementIterator to
// allow the caller to iterate over elements of a collection-typed value.
//
// Its usage pattern is as follows:
//
//     it := val.ElementIterator()
//     for it.Next() {
//         key, val := it.Element()
//         // ...
//     }
type ElementIterator interface {
	Next() bool
	Element() (key Value, value Value)
}

func canElementIterator(val Value) bool {
	switch {
	case val.IsMarked():
		return false
	case val.ty.IsListType():
		return true
	case val.ty.IsMapType():
		return true
	case val.ty.IsSetType():
		return true
	case val.ty.IsTupleType():
		return true
	case val.ty.IsObjectType():
		return true
	default:
		return false
	}
}

func elementIterator(val Value) ElementIterator {
	val.assertUnmarked()
	switch {
	case val.ty.IsListType():
		return &listElementIterator{
			ety:  val.ty.ElementType(),
			vals: val.v.([]interface{}),
			idx:  -1,
		}
	case val.ty.IsMapType():
		// We iterate the keys in a predictable lexicographical order so
		// that results will always be stable given the same input map.
		rawMap := val.v.(map[string]interface{})
		keys := make([]string, 0, len(rawMap))
		for key := range rawMap {
			keys = append(keys, key)
		}
		sort.Strings(keys)

		return &mapElementIterator{
			ety:  val.ty.ElementType(),
			vals: rawMap,
			keys: keys,
			idx:  -1,
		}
	case val.ty.IsSetType():
		rawSet := val.v.(set.Set[interface{}])
		return &setElementIterator{
			ety:   val.ty.ElementType(),
			setIt: rawSet.Iterator(),
		}
	case val.ty.IsTupleType():
		return &tupleElementIterator{
			etys: val.ty.TupleElementTypes(),
			vals: val.v.([]interface{}),
			idx:  -1,
		}
	case val.ty.IsObjectType():
		// We iterate the keys in a predictable lexicographical order so
		// that results will always be stable given the same object type.
		atys := val.ty.AttributeTypes()
		keys := make([]string, 0, len(atys))
		for key := range atys {
			keys = append(keys, key)
		}
		sort.Strings(keys)

		return &objectElementIterator{
			atys:      atys,
			vals:      val.v.(map[string]interface{}),
			attrNames: keys,
			idx:       -1,
		}
	default:
		panic("attempt to iterate on non-collection, non-tuple type")
	}
}

type listElementIterator struct {
	ety  Type
	vals []interface{}
	idx  int
}

func (it *listElementIterator) Element() (Value, Value) {
	i := it.idx
	return NumberIntVal(int64(i)), Value{
		ty: it.ety,
		v:  it.vals[i],
	}
}

func (it *listElementIterator) Next() bool {
	it.idx++
	return it.idx < len(it.vals)
}

type mapElementIterator struct {
	ety  Type
	vals map[string]interface{}
	keys []string
	idx  int
}

func (it *mapElementIterator) Element() (Value, Value) {
	key := it.keys[it.idx]
	return StringVal(key), Value{
		ty: it.ety,
		v:  it.vals[key],
	}
}

func (it *mapElementIterator) Next() bool {
	it.idx++
	return it.idx < len(it.keys)
}

type setElementIterator struct {
	ety   Type
	setIt *set.Iterator[interface{}]
}

func (it *setElementIterator) Element() (Value, Value) {
	val := Value{
		ty: it.ety,
		v:  it.setIt.Value(),
	}
	return val, val
}

func (it *setElementIterator) Next() bool {
	return it.setIt.Next()
}

type tupleElementIterator struct {
	etys []Type
	vals []interface{}
	idx  int
}

func (it *tupleElementIterator) Element() (Value, Value) {
	i := it.idx
	return NumberIntVal(int64(i)), Value{
		ty: it.etys[i],
		v:  it.vals[i],
	}
}

func (it *tupleElementIterator) Next() bool {
	it.idx++
	return it.idx < len(it.vals)
}

type objectElementIterator struct {
	atys      map[string]Type
	vals      map[string]interface{}
	attrNames []string
	idx       int
}

func (it *objectElementIterator) Element() (Value, Value) {
	key := it.attrNames[it.idx]
	return StringVal(key), Value{
		ty: it.atys[key],
		v:  it.vals[key],
	}
}

func (it *objectElementIterator) Next() bool {
	it.idx++
	return it.idx < len(it.attrNames)
}
