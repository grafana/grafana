package builtin

import (
	"fmt"
	"math"
	"reflect"
	"strconv"
	"unicode/utf8"

	"github.com/expr-lang/expr/internal/deref"
	"github.com/expr-lang/expr/vm/runtime"
)

func Len(x any) any {
	v := reflect.ValueOf(x)
	switch v.Kind() {
	case reflect.Array, reflect.Slice, reflect.Map:
		return v.Len()
	case reflect.String:
		return utf8.RuneCountInString(v.String())
	default:
		panic(fmt.Sprintf("invalid argument for len (type %T)", x))
	}
}

func Type(arg any) any {
	if arg == nil {
		return "nil"
	}
	v := reflect.ValueOf(arg)
	if v.Type().Name() != "" && v.Type().PkgPath() != "" {
		return fmt.Sprintf("%s.%s", v.Type().PkgPath(), v.Type().Name())
	}
	switch v.Type().Kind() {
	case reflect.Invalid:
		return "invalid"
	case reflect.Bool:
		return "bool"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return "int"
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "uint"
	case reflect.Float32, reflect.Float64:
		return "float"
	case reflect.String:
		return "string"
	case reflect.Array, reflect.Slice:
		return "array"
	case reflect.Map:
		return "map"
	case reflect.Func:
		return "func"
	case reflect.Struct:
		return "struct"
	default:
		return "unknown"
	}
}

func Abs(x any) any {
	switch x := x.(type) {
	case float32:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case float64:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case int:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case int8:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case int16:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case int32:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case int64:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case uint:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case uint8:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case uint16:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case uint32:
		if x < 0 {
			return -x
		} else {
			return x
		}
	case uint64:
		if x < 0 {
			return -x
		} else {
			return x
		}
	}
	panic(fmt.Sprintf("invalid argument for abs (type %T)", x))
}

func Ceil(x any) any {
	switch x := x.(type) {
	case float32:
		return math.Ceil(float64(x))
	case float64:
		return math.Ceil(x)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return Float(x)
	}
	panic(fmt.Sprintf("invalid argument for ceil (type %T)", x))
}

func Floor(x any) any {
	switch x := x.(type) {
	case float32:
		return math.Floor(float64(x))
	case float64:
		return math.Floor(x)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return Float(x)
	}
	panic(fmt.Sprintf("invalid argument for floor (type %T)", x))
}

func Round(x any) any {
	switch x := x.(type) {
	case float32:
		return math.Round(float64(x))
	case float64:
		return math.Round(x)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return Float(x)
	}
	panic(fmt.Sprintf("invalid argument for round (type %T)", x))
}

func Int(x any) any {
	switch x := x.(type) {
	case float32:
		return int(x)
	case float64:
		return int(x)
	case int:
		return x
	case int8:
		return int(x)
	case int16:
		return int(x)
	case int32:
		return int(x)
	case int64:
		return int(x)
	case uint:
		return int(x)
	case uint8:
		return int(x)
	case uint16:
		return int(x)
	case uint32:
		return int(x)
	case uint64:
		return int(x)
	case string:
		i, err := strconv.Atoi(x)
		if err != nil {
			panic(fmt.Sprintf("invalid operation: int(%s)", x))
		}
		return i
	default:
		val := reflect.ValueOf(x)
		if val.CanConvert(integerType) {
			return val.Convert(integerType).Interface()
		}
		panic(fmt.Sprintf("invalid operation: int(%T)", x))
	}
}

func Float(x any) any {
	switch x := x.(type) {
	case float32:
		return float64(x)
	case float64:
		return x
	case int:
		return float64(x)
	case int8:
		return float64(x)
	case int16:
		return float64(x)
	case int32:
		return float64(x)
	case int64:
		return float64(x)
	case uint:
		return float64(x)
	case uint8:
		return float64(x)
	case uint16:
		return float64(x)
	case uint32:
		return float64(x)
	case uint64:
		return float64(x)
	case string:
		f, err := strconv.ParseFloat(x, 64)
		if err != nil {
			panic(fmt.Sprintf("invalid operation: float(%s)", x))
		}
		return f
	default:
		panic(fmt.Sprintf("invalid operation: float(%T)", x))
	}
}

func String(arg any) any {
	return fmt.Sprintf("%v", arg)
}

func minMax(name string, fn func(any, any) bool, depth int, args ...any) (any, error) {
	if depth > MaxDepth {
		return nil, ErrorMaxDepth
	}
	var val any
	for _, arg := range args {
		rv := reflect.ValueOf(arg)
		switch rv.Kind() {
		case reflect.Array, reflect.Slice:
			size := rv.Len()
			for i := 0; i < size; i++ {
				elemVal, err := minMax(name, fn, depth+1, rv.Index(i).Interface())
				if err != nil {
					return nil, err
				}
				switch elemVal.(type) {
				case int, int8, int16, int32, int64,
					uint, uint8, uint16, uint32, uint64,
					float32, float64:
					if elemVal != nil && (val == nil || fn(val, elemVal)) {
						val = elemVal
					}
				default:
					return nil, fmt.Errorf("invalid argument for %s (type %T)", name, elemVal)
				}

			}
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
			reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
			reflect.Float32, reflect.Float64:
			elemVal := rv.Interface()
			if val == nil || fn(val, elemVal) {
				val = elemVal
			}
		default:
			if len(args) == 1 {
				return args[0], nil
			}
			return nil, fmt.Errorf("invalid argument for %s (type %T)", name, arg)
		}
	}
	return val, nil
}

func mean(depth int, args ...any) (int, float64, error) {
	if depth > MaxDepth {
		return 0, 0, ErrorMaxDepth
	}
	var total float64
	var count int

	for _, arg := range args {
		rv := reflect.ValueOf(arg)
		switch rv.Kind() {
		case reflect.Array, reflect.Slice:
			size := rv.Len()
			for i := 0; i < size; i++ {
				elemCount, elemSum, err := mean(depth+1, rv.Index(i).Interface())
				if err != nil {
					return 0, 0, err
				}
				total += elemSum
				count += elemCount
			}
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			total += float64(rv.Int())
			count++
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			total += float64(rv.Uint())
			count++
		case reflect.Float32, reflect.Float64:
			total += rv.Float()
			count++
		default:
			return 0, 0, fmt.Errorf("invalid argument for mean (type %T)", arg)
		}
	}
	return count, total, nil
}

func median(depth int, args ...any) ([]float64, error) {
	if depth > MaxDepth {
		return nil, ErrorMaxDepth
	}
	var values []float64

	for _, arg := range args {
		rv := reflect.ValueOf(arg)
		switch rv.Kind() {
		case reflect.Array, reflect.Slice:
			size := rv.Len()
			for i := 0; i < size; i++ {
				elems, err := median(depth+1, rv.Index(i).Interface())
				if err != nil {
					return nil, err
				}
				values = append(values, elems...)
			}
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			values = append(values, float64(rv.Int()))
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			values = append(values, float64(rv.Uint()))
		case reflect.Float32, reflect.Float64:
			values = append(values, rv.Float())
		default:
			return nil, fmt.Errorf("invalid argument for median (type %T)", arg)
		}
	}
	return values, nil
}

func flatten(arg reflect.Value, depth int) ([]any, error) {
	if depth > MaxDepth {
		return nil, ErrorMaxDepth
	}
	ret := []any{}
	for i := 0; i < arg.Len(); i++ {
		v := deref.Value(arg.Index(i))
		if v.Kind() == reflect.Array || v.Kind() == reflect.Slice {
			x, err := flatten(v, depth+1)
			if err != nil {
				return nil, err
			}
			ret = append(ret, x...)
		} else {
			ret = append(ret, v.Interface())
		}
	}
	return ret, nil
}

func get(params ...any) (out any, err error) {
	from := params[0]
	i := params[1]
	v := reflect.ValueOf(from)

	if from == nil {
		return nil, nil
	}

	if v.Kind() == reflect.Invalid {
		panic(fmt.Sprintf("cannot fetch %v from %T", i, from))
	}

	// Methods can be defined on any type.
	if v.NumMethod() > 0 {
		if methodName, ok := i.(string); ok {
			method := v.MethodByName(methodName)
			if method.IsValid() {
				return method.Interface(), nil
			}
		}
	}

	switch v.Kind() {
	case reflect.Array, reflect.Slice, reflect.String:
		index := runtime.ToInt(i)
		l := v.Len()
		if index < 0 {
			index = l + index
		}
		if 0 <= index && index < l {
			value := v.Index(index)
			if value.IsValid() {
				return value.Interface(), nil
			}
		}

	case reflect.Map:
		var value reflect.Value
		if i == nil {
			value = v.MapIndex(reflect.Zero(v.Type().Key()))
		} else {
			value = v.MapIndex(reflect.ValueOf(i))
		}
		if value.IsValid() {
			return value.Interface(), nil
		}

	case reflect.Struct:
		fieldName := i.(string)
		value := v.FieldByNameFunc(func(name string) bool {
			field, _ := v.Type().FieldByName(name)
			switch field.Tag.Get("expr") {
			case "-":
				return false
			case fieldName:
				return true
			default:
				return name == fieldName
			}
		})
		if value.IsValid() {
			return value.Interface(), nil
		}
	}

	// Main difference from runtime.Fetch
	// is that we return `nil` instead of panic.
	return nil, nil
}
