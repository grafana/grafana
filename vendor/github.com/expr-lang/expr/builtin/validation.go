package builtin

import (
	"fmt"
	"reflect"

	"github.com/expr-lang/expr/internal/deref"
)

func validateAggregateFunc(name string, args []reflect.Type) (reflect.Type, error) {
	switch len(args) {
	case 0:
		return anyType, fmt.Errorf("not enough arguments to call %s", name)
	default:
		for _, arg := range args {
			switch kind(deref.Type(arg)) {
			case reflect.Interface, reflect.Array, reflect.Slice:
				return anyType, nil
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Float32, reflect.Float64:
			default:
				return anyType, fmt.Errorf("invalid argument for %s (type %s)", name, arg)
			}
		}
		return args[0], nil
	}
}

func validateRoundFunc(name string, args []reflect.Type) (reflect.Type, error) {
	if len(args) != 1 {
		return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
	}
	switch kind(args[0]) {
	case reflect.Float32, reflect.Float64, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Interface:
		return floatType, nil
	default:
		return anyType, fmt.Errorf("invalid argument for %s (type %s)", name, args[0])
	}
}
