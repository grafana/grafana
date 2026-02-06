//go:build !nopgxregisterdefaulttypes

package pgtype

func registerDefaultPgTypeVariants[T any](m *Map, name string) {
	arrayName := "_" + name

	var value T
	m.RegisterDefaultPgType(value, name)  // T
	m.RegisterDefaultPgType(&value, name) // *T

	var sliceT []T
	m.RegisterDefaultPgType(sliceT, arrayName)  // []T
	m.RegisterDefaultPgType(&sliceT, arrayName) // *[]T

	var slicePtrT []*T
	m.RegisterDefaultPgType(slicePtrT, arrayName)  // []*T
	m.RegisterDefaultPgType(&slicePtrT, arrayName) // *[]*T

	var arrayOfT Array[T]
	m.RegisterDefaultPgType(arrayOfT, arrayName)  // Array[T]
	m.RegisterDefaultPgType(&arrayOfT, arrayName) // *Array[T]

	var arrayOfPtrT Array[*T]
	m.RegisterDefaultPgType(arrayOfPtrT, arrayName)  // Array[*T]
	m.RegisterDefaultPgType(&arrayOfPtrT, arrayName) // *Array[*T]

	var flatArrayOfT FlatArray[T]
	m.RegisterDefaultPgType(flatArrayOfT, arrayName)  // FlatArray[T]
	m.RegisterDefaultPgType(&flatArrayOfT, arrayName) // *FlatArray[T]

	var flatArrayOfPtrT FlatArray[*T]
	m.RegisterDefaultPgType(flatArrayOfPtrT, arrayName)  // FlatArray[*T]
	m.RegisterDefaultPgType(&flatArrayOfPtrT, arrayName) // *FlatArray[*T]
}
