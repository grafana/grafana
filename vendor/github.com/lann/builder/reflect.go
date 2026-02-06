package builder

import "reflect"

func convert(from interface{}, to interface{}) interface{} {
	return reflect.
		ValueOf(from).
		Convert(reflect.TypeOf(to)).
		Interface()
}

func forEach(s interface{}, f func(interface{})) {
	val := reflect.ValueOf(s)

	kind := val.Kind()
	if kind != reflect.Slice && kind != reflect.Array {
		panic(&reflect.ValueError{Method: "builder.forEach", Kind: kind})
	}

	l := val.Len()
	for i := 0; i < l; i++ {
		f(val.Index(i).Interface())
	}
}
