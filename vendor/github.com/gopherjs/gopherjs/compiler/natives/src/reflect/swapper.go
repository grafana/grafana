// +build js

package reflect

func Swapper(slice interface{}) func(i, j int) {
	v := ValueOf(slice)
	if v.Kind() != Slice {
		panic(&ValueError{Method: "Swapper", Kind: v.Kind()})
	}
	// Fast path for slices of size 0 and 1. Nothing to swap.
	switch v.Len() {
	case 0:
		return func(i, j int) { panic("reflect: slice index out of range") }
	case 1:
		return func(i, j int) {
			if i != 0 || j != 0 {
				panic("reflect: slice index out of range")
			}
		}
	}
	tmp := New(v.Type().Elem()).Elem()
	return func(i, j int) {
		v1 := v.Index(i)
		v2 := v.Index(j)
		tmp.Set(v1)
		v1.Set(v2)
		v2.Set(tmp)
	}
}
