//go:build appengine || gopherjs || purego
// +build appengine gopherjs purego

// NB: other environments where unsafe is unappropriate should use "purego" build tag
// https://github.com/golang/go/issues/23172

package desc

type jsonNameMap struct{}
type memoizedDefault struct{}

// FindFieldByJSONName finds the field with the given JSON field name. If no such
// field exists then nil is returned. Only regular fields are returned, not
// extensions.
func (md *MessageDescriptor) FindFieldByJSONName(jsonName string) *FieldDescriptor {
	// NB: With allowed use of unsafe, we use it to atomically define an index
	// via atomic.LoadPointer/atomic.StorePointer. Without it, we skip the index
	// and must do a linear scan of fields each time.
	for _, f := range md.fields {
		jn := f.GetJSONName()
		if jn == jsonName {
			return f
		}
	}
	return nil
}

func (fd *FieldDescriptor) getDefaultValue() interface{} {
	return fd.determineDefault()
}
