package cty

// Walk visits all of the values in a possibly-complex structure, calling
// a given function for each value.
//
// For example, given a list of strings the callback would first be called
// with the whole list and then called once for each element of the list.
//
// The callback function may prevent recursive visits to child values by
// returning false. The callback function my halt the walk altogether by
// returning a non-nil error. If the returned error is about the element
// currently being visited, it is recommended to use the provided path
// value to produce a PathError describing that context.
//
// The path passed to the given function may not be used after that function
// returns, since its backing array is re-used for other calls.
func Walk(val Value, cb func(Path, Value) (bool, error)) error {
	var path Path
	return walk(path, val, cb)
}

func walk(path Path, val Value, cb func(Path, Value) (bool, error)) error {
	deeper, err := cb(path, val)
	if err != nil {
		return err
	}
	if !deeper {
		return nil
	}

	if val.IsNull() || !val.IsKnown() {
		// Can't recurse into null or unknown values, regardless of type
		return nil
	}

	// The callback already got a chance to see the mark in our
	// call above, so can safely strip it off here in order to
	// visit the child elements, which might still have their own marks.
	rawVal, _ := val.Unmark()

	ty := val.Type()
	switch {
	case ty.IsObjectType():
		for it := rawVal.ElementIterator(); it.Next(); {
			nameVal, av := it.Element()
			path := append(path, GetAttrStep{
				Name: nameVal.AsString(),
			})
			err := walk(path, av, cb)
			if err != nil {
				return err
			}
		}
	case rawVal.CanIterateElements():
		for it := rawVal.ElementIterator(); it.Next(); {
			kv, ev := it.Element()
			path := append(path, IndexStep{
				Key: kv,
			})
			err := walk(path, ev, cb)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// Transformer is the interface used to optionally transform values in a
// possibly-complex structure. The Enter method is called before traversing
// through a given path, and the Exit method is called when traversal of a
// path is complete.
//
// Use Enter when you want to transform a complex value before traversal
// (preorder), and Exit when you want to transform a value after traversal
// (postorder).
//
// The path passed to the given function may not be used after that function
// returns, since its backing array is re-used for other calls.
type Transformer interface {
	Enter(Path, Value) (Value, error)
	Exit(Path, Value) (Value, error)
}

type postorderTransformer struct {
	callback func(Path, Value) (Value, error)
}

func (t *postorderTransformer) Enter(p Path, v Value) (Value, error) {
	return v, nil
}

func (t *postorderTransformer) Exit(p Path, v Value) (Value, error) {
	return t.callback(p, v)
}

// Transform visits all of the values in a possibly-complex structure,
// calling a given function for each value which has an opportunity to
// replace that value.
//
// Unlike Walk, Transform visits child nodes first, so for a list of strings
// it would first visit the strings and then the _new_ list constructed
// from the transformed values of the list items.
//
// This is useful for creating the effect of being able to make deep mutations
// to a value even though values are immutable. However, it's the responsibility
// of the given function to preserve expected invariants, such as homogenity of
// element types in collections; this function can panic if such invariants
// are violated, just as if new values were constructed directly using the
// value constructor functions. An easy way to preserve invariants is to
// ensure that the transform function never changes the value type.
//
// The callback function may halt the walk altogether by
// returning a non-nil error. If the returned error is about the element
// currently being visited, it is recommended to use the provided path
// value to produce a PathError describing that context.
//
// The path passed to the given function may not be used after that function
// returns, since its backing array is re-used for other calls.
func Transform(val Value, cb func(Path, Value) (Value, error)) (Value, error) {
	var path Path
	return transform(path, val, &postorderTransformer{cb})
}

// TransformWithTransformer allows the caller to more closely control the
// traversal used for transformation. See the documentation for Transformer for
// more details.
func TransformWithTransformer(val Value, t Transformer) (Value, error) {
	var path Path
	return transform(path, val, t)
}

func transform(path Path, val Value, t Transformer) (Value, error) {
	val, err := t.Enter(path, val)
	if err != nil {
		return DynamicVal, err
	}

	ty := val.Type()
	var newVal Value

	// We need to peel off any marks here so that we can dig around
	// inside any collection values. We'll reapply these to any
	// new collections we construct, but the transformer's Exit
	// method gets the final say on what to do with those.
	rawVal, marks := val.Unmark()

	switch {

	case val.IsNull() || !val.IsKnown():
		// Can't recurse into null or unknown values, regardless of type
		newVal = val

	case ty.IsListType() || ty.IsSetType() || ty.IsTupleType():
		l := rawVal.LengthInt()
		switch l {
		case 0:
			// No deep transform for an empty sequence
			newVal = val
		default:
			elems := make([]Value, 0, l)
			for it := rawVal.ElementIterator(); it.Next(); {
				kv, ev := it.Element()
				path := append(path, IndexStep{
					Key: kv,
				})
				newEv, err := transform(path, ev, t)
				if err != nil {
					return DynamicVal, err
				}
				elems = append(elems, newEv)
			}
			switch {
			case ty.IsListType():
				newVal = ListVal(elems).WithMarks(marks)
			case ty.IsSetType():
				newVal = SetVal(elems).WithMarks(marks)
			case ty.IsTupleType():
				newVal = TupleVal(elems).WithMarks(marks)
			default:
				panic("unknown sequence type") // should never happen because of the case we are in
			}
		}

	case ty.IsMapType():
		l := rawVal.LengthInt()
		switch l {
		case 0:
			// No deep transform for an empty map
			newVal = val
		default:
			elems := make(map[string]Value)
			for it := rawVal.ElementIterator(); it.Next(); {
				kv, ev := it.Element()
				path := append(path, IndexStep{
					Key: kv,
				})
				newEv, err := transform(path, ev, t)
				if err != nil {
					return DynamicVal, err
				}
				elems[kv.AsString()] = newEv
			}
			newVal = MapVal(elems).WithMarks(marks)
		}

	case ty.IsObjectType():
		switch {
		case ty.Equals(EmptyObject):
			// No deep transform for an empty object
			newVal = val
		default:
			atys := ty.AttributeTypes()
			newAVs := make(map[string]Value)
			for name := range atys {
				av := val.GetAttr(name)
				path := append(path, GetAttrStep{
					Name: name,
				})
				newAV, err := transform(path, av, t)
				if err != nil {
					return DynamicVal, err
				}
				newAVs[name] = newAV
			}
			newVal = ObjectVal(newAVs).WithMarks(marks)
		}

	default:
		newVal = val
	}

	newVal, err = t.Exit(path, newVal)
	if err != nil {
		return DynamicVal, err
	}
	return newVal, err
}
