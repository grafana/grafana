package builder

import (
	"reflect"
	"sync"
)

var (
	registry = make(map[reflect.Type]reflect.Type)
	registryMux sync.RWMutex
)

// RegisterType maps the given builderType to a structType.
// This mapping affects the type of slices returned by Get and is required for
// GetStruct to work.
//
// Returns a Value containing an empty instance of the registered builderType.
//
// RegisterType will panic if builderType's underlying type is not Builder or
// if structType's Kind is not Struct.
func RegisterType(builderType reflect.Type, structType reflect.Type) *reflect.Value {
	registryMux.Lock()
	defer registryMux.Unlock()
	structType.NumField() // Panic if structType is not a struct
	registry[builderType] = structType
	emptyValue := emptyBuilderValue.Convert(builderType)
	return &emptyValue
}

// Register wraps RegisterType, taking instances instead of Types.
//
// Returns an empty instance of the registered builder type which can be used
// as the initial value for builder expressions. See example.
func Register(builderProto, structProto interface{}) interface{} {
	empty := RegisterType(
		reflect.TypeOf(builderProto),
		reflect.TypeOf(structProto),
	).Interface()
	return empty
}

func getBuilderStructType(builderType reflect.Type) *reflect.Type {
	registryMux.RLock()
	defer registryMux.RUnlock()
	structType, ok := registry[builderType]
	if !ok {
		return nil
	}
	return &structType
}

func newBuilderStruct(builderType reflect.Type) *reflect.Value {
	structType := getBuilderStructType(builderType)
	if structType == nil {
		return nil
	}
	newStruct := reflect.New(*structType).Elem()
	return &newStruct
}
