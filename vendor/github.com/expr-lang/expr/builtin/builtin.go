package builtin

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/expr-lang/expr/internal/deref"
	"github.com/expr-lang/expr/vm/runtime"
)

var (
	Index map[string]int
	Names []string

	// MaxDepth limits the recursion depth for nested structures.
	MaxDepth      = 10000
	ErrorMaxDepth = errors.New("recursion depth exceeded")
)

func init() {
	Index = make(map[string]int)
	Names = make([]string, len(Builtins))
	for i, fn := range Builtins {
		Index[fn.Name] = i
		Names[i] = fn.Name
	}
}

var Builtins = []*Function{
	{
		Name:      "all",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) bool)),
	},
	{
		Name:      "none",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) bool)),
	},
	{
		Name:      "any",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) bool)),
	},
	{
		Name:      "one",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) bool)),
	},
	{
		Name:      "filter",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) []any)),
	},
	{
		Name:      "map",
		Predicate: true,
		Types:     types(new(func([]any, func(any) any) []any)),
	},
	{
		Name:      "find",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) any)),
	},
	{
		Name:      "findIndex",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) int)),
	},
	{
		Name:      "findLast",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) any)),
	},
	{
		Name:      "findLastIndex",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) int)),
	},
	{
		Name:      "count",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) int)),
	},
	{
		Name:      "sum",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool) int)),
	},
	{
		Name:      "groupBy",
		Predicate: true,
		Types:     types(new(func([]any, func(any) any) map[any][]any)),
	},
	{
		Name:      "sortBy",
		Predicate: true,
		Types:     types(new(func([]any, func(any) bool, string) []any)),
	},
	{
		Name:      "reduce",
		Predicate: true,
		Types:     types(new(func([]any, func(any, any) any, any) any)),
	},
	{
		Name: "len",
		Fast: Len,
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Array, reflect.Map, reflect.Slice, reflect.String, reflect.Interface:
				return integerType, nil
			}
			return anyType, fmt.Errorf("invalid argument for len (type %s)", args[0])
		},
	},
	{
		Name:  "type",
		Fast:  Type,
		Types: types(new(func(any) string)),
	},
	{
		Name: "abs",
		Fast: Abs,
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Float32, reflect.Float64, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Interface:
				return args[0], nil
			}
			return anyType, fmt.Errorf("invalid argument for abs (type %s)", args[0])
		},
	},
	{
		Name: "ceil",
		Fast: Ceil,
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			return validateRoundFunc("ceil", args)
		},
	},
	{
		Name: "floor",
		Fast: Floor,
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			return validateRoundFunc("floor", args)
		},
	},
	{
		Name: "round",
		Fast: Round,
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			return validateRoundFunc("round", args)
		},
	},
	{
		Name: "int",
		Fast: Int,
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface:
				return integerType, nil
			case reflect.Float32, reflect.Float64, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				return integerType, nil
			case reflect.String:
				return integerType, nil
			}
			return anyType, fmt.Errorf("invalid argument for int (type %s)", args[0])
		},
	},
	{
		Name: "float",
		Fast: Float,
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface:
				return floatType, nil
			case reflect.Float32, reflect.Float64, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				return floatType, nil
			case reflect.String:
				return floatType, nil
			}
			return anyType, fmt.Errorf("invalid argument for float (type %s)", args[0])
		},
	},
	{
		Name:  "string",
		Fast:  String,
		Types: types(new(func(any any) string)),
	},
	{
		Name: "trim",
		Func: func(args ...any) (any, error) {
			if len(args) == 1 {
				return strings.TrimSpace(args[0].(string)), nil
			} else if len(args) == 2 {
				return strings.Trim(args[0].(string), args[1].(string)), nil
			} else {
				return nil, fmt.Errorf("invalid number of arguments for trim (expected 1 or 2, got %d)", len(args))
			}
		},
		Types: types(
			strings.TrimSpace,
			strings.Trim,
		),
	},
	{
		Name: "trimPrefix",
		Func: func(args ...any) (any, error) {
			s := " "
			if len(args) == 2 {
				s = args[1].(string)
			}
			return strings.TrimPrefix(args[0].(string), s), nil
		},
		Types: types(
			strings.TrimPrefix,
			new(func(string) string),
		),
	},
	{
		Name: "trimSuffix",
		Func: func(args ...any) (any, error) {
			s := " "
			if len(args) == 2 {
				s = args[1].(string)
			}
			return strings.TrimSuffix(args[0].(string), s), nil
		},
		Types: types(
			strings.TrimSuffix,
			new(func(string) string),
		),
	},
	{
		Name: "upper",
		Fast: func(arg any) any {
			return strings.ToUpper(arg.(string))
		},
		Types: types(strings.ToUpper),
	},
	{
		Name: "lower",
		Fast: func(arg any) any {
			return strings.ToLower(arg.(string))
		},
		Types: types(strings.ToLower),
	},
	{
		Name: "split",
		Func: func(args ...any) (any, error) {
			if len(args) == 2 {
				return strings.Split(args[0].(string), args[1].(string)), nil
			} else if len(args) == 3 {
				return strings.SplitN(args[0].(string), args[1].(string), runtime.ToInt(args[2])), nil
			} else {
				return nil, fmt.Errorf("invalid number of arguments for split (expected 2 or 3, got %d)", len(args))
			}
		},
		Types: types(
			strings.Split,
			strings.SplitN,
		),
	},
	{
		Name: "splitAfter",
		Func: func(args ...any) (any, error) {
			if len(args) == 2 {
				return strings.SplitAfter(args[0].(string), args[1].(string)), nil
			} else if len(args) == 3 {
				return strings.SplitAfterN(args[0].(string), args[1].(string), runtime.ToInt(args[2])), nil
			} else {
				return nil, fmt.Errorf("invalid number of arguments for splitAfter (expected 2 or 3, got %d)", len(args))
			}
		},
		Types: types(
			strings.SplitAfter,
			strings.SplitAfterN,
		),
	},
	{
		Name: "replace",
		Func: func(args ...any) (any, error) {
			if len(args) == 4 {
				return strings.Replace(args[0].(string), args[1].(string), args[2].(string), runtime.ToInt(args[3])), nil
			} else if len(args) == 3 {
				return strings.ReplaceAll(args[0].(string), args[1].(string), args[2].(string)), nil
			} else {
				return nil, fmt.Errorf("invalid number of arguments for replace (expected 3 or 4, got %d)", len(args))
			}
		},
		Types: types(
			strings.Replace,
			strings.ReplaceAll,
		),
	},
	{
		Name: "repeat",
		Safe: func(args ...any) (any, uint, error) {
			s := args[0].(string)
			n := runtime.ToInt(args[1])
			if n < 0 {
				return nil, 0, fmt.Errorf("invalid argument for repeat (expected positive integer, got %d)", n)
			}
			if n > 1e6 {
				return nil, 0, fmt.Errorf("memory budget exceeded")
			}
			return strings.Repeat(s, n), uint(len(s) * n), nil
		},
		Types: types(strings.Repeat),
	},
	{
		Name: "join",
		Func: func(args ...any) (any, error) {
			glue := ""
			if len(args) == 2 {
				glue = args[1].(string)
			}
			switch args[0].(type) {
			case []string:
				return strings.Join(args[0].([]string), glue), nil
			case []any:
				var s []string
				for _, arg := range args[0].([]any) {
					s = append(s, arg.(string))
				}
				return strings.Join(s, glue), nil
			}
			return nil, fmt.Errorf("invalid argument for join (type %s)", reflect.TypeOf(args[0]))
		},
		Types: types(
			strings.Join,
			new(func([]any, string) string),
			new(func([]any) string),
			new(func([]string, string) string),
			new(func([]string) string),
		),
	},
	{
		Name: "indexOf",
		Func: func(args ...any) (any, error) {
			return strings.Index(args[0].(string), args[1].(string)), nil
		},
		Types: types(strings.Index),
	},
	{
		Name: "lastIndexOf",
		Func: func(args ...any) (any, error) {
			return strings.LastIndex(args[0].(string), args[1].(string)), nil
		},
		Types: types(strings.LastIndex),
	},
	{
		Name: "hasPrefix",
		Func: func(args ...any) (any, error) {
			return strings.HasPrefix(args[0].(string), args[1].(string)), nil
		},
		Types: types(strings.HasPrefix),
	},
	{
		Name: "hasSuffix",
		Func: func(args ...any) (any, error) {
			return strings.HasSuffix(args[0].(string), args[1].(string)), nil
		},
		Types: types(strings.HasSuffix),
	},
	{
		Name: "max",
		Func: func(args ...any) (any, error) {
			return minMax("max", runtime.Less, 0, args...)
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			return validateAggregateFunc("max", args)
		},
	},
	{
		Name: "min",
		Func: func(args ...any) (any, error) {
			return minMax("min", runtime.More, 0, args...)
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			return validateAggregateFunc("min", args)
		},
	},
	{
		Name: "mean",
		Func: func(args ...any) (any, error) {
			count, sum, err := mean(0, args...)
			if err != nil {
				return nil, err
			}
			if count == 0 {
				return 0.0, nil
			}
			return sum / float64(count), nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			return validateAggregateFunc("mean", args)
		},
	},
	{
		Name: "median",
		Func: func(args ...any) (any, error) {
			values, err := median(0, args...)
			if err != nil {
				return nil, err
			}
			if n := len(values); n > 0 {
				sort.Float64s(values)
				if n%2 == 1 {
					return values[n/2], nil
				}
				return (values[n/2-1] + values[n/2]) / 2, nil
			}
			return 0.0, nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			return validateAggregateFunc("median", args)
		},
	},
	{
		Name: "toJSON",
		Func: func(args ...any) (any, error) {
			b, err := json.MarshalIndent(args[0], "", "  ")
			if err != nil {
				return nil, err
			}
			return string(b), nil
		},
		Types: types(new(func(any) string)),
	},
	{
		Name: "fromJSON",
		Func: func(args ...any) (any, error) {
			var v any
			err := json.Unmarshal([]byte(args[0].(string)), &v)
			if err != nil {
				return nil, err
			}
			return v, nil
		},
		Types: types(new(func(string) any)),
	},
	{
		Name: "toBase64",
		Func: func(args ...any) (any, error) {
			return base64.StdEncoding.EncodeToString([]byte(args[0].(string))), nil
		},
		Types: types(new(func(string) string)),
	},
	{
		Name: "fromBase64",
		Func: func(args ...any) (any, error) {
			b, err := base64.StdEncoding.DecodeString(args[0].(string))
			if err != nil {
				return nil, err
			}
			return string(b), nil
		},
		Types: types(new(func(string) string)),
	},
	{
		Name: "now",
		Func: func(args ...any) (any, error) {
			if len(args) == 0 {
				return time.Now(), nil
			}
			if len(args) == 1 {
				if tz, ok := args[0].(*time.Location); ok {
					return time.Now().In(tz), nil
				}
			}
			return nil, fmt.Errorf("invalid number of arguments (expected 0, got %d)", len(args))
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) == 0 {
				return timeType, nil
			}
			if len(args) == 1 {
				if args[0] != nil && args[0].AssignableTo(locationType) {
					return timeType, nil
				}
			}
			return anyType, fmt.Errorf("invalid number of arguments (expected 0, got %d)", len(args))
		},
		Deref: func(i int, arg reflect.Type) bool {
			return false
		},
	},
	{
		Name: "duration",
		Func: func(args ...any) (any, error) {
			return time.ParseDuration(args[0].(string))
		},
		Types: types(time.ParseDuration),
	},
	{
		Name: "date",
		Func: func(args ...any) (any, error) {
			tz, ok := args[0].(*time.Location)
			if ok {
				args = args[1:]
			}

			date := args[0].(string)
			if len(args) == 2 {
				layout := args[1].(string)
				if tz != nil {
					return time.ParseInLocation(layout, date, tz)
				}
				return time.Parse(layout, date)
			}
			if len(args) == 3 {
				layout := args[1].(string)
				timeZone := args[2].(string)
				tz, err := time.LoadLocation(timeZone)
				if err != nil {
					return nil, err
				}
				t, err := time.ParseInLocation(layout, date, tz)
				if err != nil {
					return nil, err
				}
				return t, nil
			}

			layouts := []string{
				"2006-01-02",
				"15:04:05",
				"2006-01-02 15:04:05",
				time.RFC3339,
				time.RFC822,
				time.RFC850,
				time.RFC1123,
			}
			for _, layout := range layouts {
				if tz == nil {
					t, err := time.Parse(layout, date)
					if err == nil {
						return t, nil
					}
				} else {
					t, err := time.ParseInLocation(layout, date, tz)
					if err == nil {
						return t, nil
					}
				}
			}
			return nil, fmt.Errorf("invalid date %s", date)
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) < 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected at least 1, got %d)", len(args))
			}
			if args[0] != nil && args[0].AssignableTo(locationType) {
				args = args[1:]
			}
			if len(args) > 3 {
				return anyType, fmt.Errorf("invalid number of arguments (expected at most 3, got %d)", len(args))
			}
			return timeType, nil
		},
		Deref: func(i int, arg reflect.Type) bool {
			if arg.AssignableTo(locationType) {
				return false
			}
			return true
		},
	},
	{
		Name: "timezone",
		Func: func(args ...any) (any, error) {
			tz, err := time.LoadLocation(args[0].(string))
			if err != nil {
				return nil, err
			}
			return tz, nil
		},
		Types: types(time.LoadLocation),
	},
	{
		Name: "first",
		Func: func(args ...any) (any, error) {
			defer func() {
				if r := recover(); r != nil {
					return
				}
			}()
			return runtime.Fetch(args[0], 0), nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface:
				return anyType, nil
			case reflect.Slice, reflect.Array:
				return args[0].Elem(), nil
			}
			return anyType, fmt.Errorf("cannot get first element from %s", args[0])
		},
	},
	{
		Name: "last",
		Func: func(args ...any) (any, error) {
			defer func() {
				if r := recover(); r != nil {
					return
				}
			}()
			return runtime.Fetch(args[0], -1), nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface:
				return anyType, nil
			case reflect.Slice, reflect.Array:
				return args[0].Elem(), nil
			}
			return anyType, fmt.Errorf("cannot get last element from %s", args[0])
		},
	},
	{
		Name: "get",
		Func: get,
	},
	{
		Name: "take",
		Func: func(args ...any) (any, error) {
			if len(args) != 2 {
				return nil, fmt.Errorf("invalid number of arguments (expected 2, got %d)", len(args))
			}
			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Slice && v.Kind() != reflect.Array {
				return nil, fmt.Errorf("cannot take from %s", v.Kind())
			}
			n := reflect.ValueOf(args[1])
			if !n.CanInt() {
				return nil, fmt.Errorf("cannot take %s elements", n.Kind())
			}
			to := 0
			if n.Int() > int64(v.Len()) {
				to = v.Len()
			} else {
				to = int(n.Int())
			}
			return v.Slice(0, to).Interface(), nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 2 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 2, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface, reflect.Slice, reflect.Array:
			default:
				return anyType, fmt.Errorf("cannot take from %s", args[0])
			}
			switch kind(args[1]) {
			case reflect.Interface, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			default:
				return anyType, fmt.Errorf("cannot take %s elements", args[1])
			}
			return args[0], nil
		},
	},
	{
		Name: "keys",
		Func: func(args ...any) (any, error) {
			if len(args) != 1 {
				return nil, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Map {
				return nil, fmt.Errorf("cannot get keys from %s", v.Kind())
			}
			keys := v.MapKeys()
			out := make([]any, len(keys))
			for i, key := range keys {
				out[i] = key.Interface()
			}
			return out, nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface:
				return arrayType, nil
			case reflect.Map:
				return arrayType, nil
			}
			return anyType, fmt.Errorf("cannot get keys from %s", args[0])
		},
	},
	{
		Name: "values",
		Func: func(args ...any) (any, error) {
			if len(args) != 1 {
				return nil, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Map {
				return nil, fmt.Errorf("cannot get values from %s", v.Kind())
			}
			keys := v.MapKeys()
			out := make([]any, len(keys))
			for i, key := range keys {
				out[i] = v.MapIndex(key).Interface()
			}
			return out, nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface:
				return arrayType, nil
			case reflect.Map:
				return arrayType, nil
			}
			return anyType, fmt.Errorf("cannot get values from %s", args[0])
		},
	},
	{
		Name: "toPairs",
		Func: func(args ...any) (any, error) {
			if len(args) != 1 {
				return nil, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Map {
				return nil, fmt.Errorf("cannot transform %s to pairs", v.Kind())
			}
			keys := v.MapKeys()
			out := make([][2]any, len(keys))
			for i, key := range keys {
				out[i] = [2]any{key.Interface(), v.MapIndex(key).Interface()}
			}
			return out, nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface, reflect.Map:
				return arrayType, nil
			}
			return anyType, fmt.Errorf("cannot transform %s to pairs", args[0])
		},
	},
	{
		Name: "fromPairs",
		Func: func(args ...any) (any, error) {
			if len(args) != 1 {
				return nil, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Slice && v.Kind() != reflect.Array {
				return nil, fmt.Errorf("cannot transform %s from pairs", v)
			}
			out := reflect.MakeMap(mapType)
			for i := 0; i < v.Len(); i++ {
				pair := deref.Value(v.Index(i))
				if pair.Kind() != reflect.Array && pair.Kind() != reflect.Slice {
					return nil, fmt.Errorf("invalid pair %v", pair)
				}
				if pair.Len() != 2 {
					return nil, fmt.Errorf("invalid pair length %v", pair)
				}
				key := pair.Index(0)
				value := pair.Index(1)
				out.SetMapIndex(key, value)
			}
			return out.Interface(), nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface, reflect.Slice, reflect.Array:
				return mapType, nil
			}
			return anyType, fmt.Errorf("cannot transform %s from pairs", args[0])
		},
	},
	{
		Name: "reverse",
		Safe: func(args ...any) (any, uint, error) {
			if len(args) != 1 {
				return nil, 0, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}

			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Slice && v.Kind() != reflect.Array {
				return nil, 0, fmt.Errorf("cannot reverse %s", v.Kind())
			}

			size := v.Len()
			arr := make([]any, size)

			for i := 0; i < size; i++ {
				arr[i] = v.Index(size - i - 1).Interface()
			}

			return arr, uint(size), nil

		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			switch kind(args[0]) {
			case reflect.Interface, reflect.Slice, reflect.Array:
				return arrayType, nil
			default:
				return anyType, fmt.Errorf("cannot reverse %s", args[0])
			}
		},
	},

	{
		Name: "uniq",
		Func: func(args ...any) (any, error) {
			if len(args) != 1 {
				return nil, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}

			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Array && v.Kind() != reflect.Slice {
				return nil, fmt.Errorf("cannot uniq %s", v.Kind())
			}

			size := v.Len()
			ret := []any{}

			eq := func(i int) bool {
				for _, r := range ret {
					if runtime.Equal(v.Index(i).Interface(), r) {
						return true
					}
				}

				return false
			}

			for i := 0; i < size; i += 1 {
				if eq(i) {
					continue
				}

				ret = append(ret, v.Index(i).Interface())
			}

			return ret, nil
		},

		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}

			switch kind(args[0]) {
			case reflect.Interface, reflect.Slice, reflect.Array:
				return arrayType, nil
			default:
				return anyType, fmt.Errorf("cannot uniq %s", args[0])
			}
		},
	},

	{
		Name: "concat",
		Safe: func(args ...any) (any, uint, error) {
			if len(args) == 0 {
				return nil, 0, fmt.Errorf("invalid number of arguments (expected at least 1, got 0)")
			}

			var size uint
			var arr []any

			for _, arg := range args {
				v := reflect.ValueOf(arg)

				if v.Kind() != reflect.Slice && v.Kind() != reflect.Array {
					return nil, 0, fmt.Errorf("cannot concat %s", v.Kind())
				}

				size += uint(v.Len())

				for i := 0; i < v.Len(); i++ {
					item := v.Index(i)
					arr = append(arr, item.Interface())
				}
			}

			return arr, size, nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) == 0 {
				return anyType, fmt.Errorf("invalid number of arguments (expected at least 1, got 0)")
			}

			for _, arg := range args {
				switch kind(arg) {
				case reflect.Interface, reflect.Slice, reflect.Array:
				default:
					return anyType, fmt.Errorf("cannot concat %s", arg)
				}
			}

			return arrayType, nil
		},
	},
	{
		Name: "flatten",
		Safe: func(args ...any) (any, uint, error) {
			var size uint
			if len(args) != 1 {
				return nil, 0, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}
			v := reflect.ValueOf(args[0])
			if v.Kind() != reflect.Array && v.Kind() != reflect.Slice {
				return nil, size, fmt.Errorf("cannot flatten %s", v.Kind())
			}
			ret, err := flatten(v, 0)
			if err != nil {
				return nil, 0, err
			}
			size = uint(len(ret))
			return ret, size, nil
		},
		Validate: func(args []reflect.Type) (reflect.Type, error) {
			if len(args) != 1 {
				return anyType, fmt.Errorf("invalid number of arguments (expected 1, got %d)", len(args))
			}

			for _, arg := range args {
				switch kind(arg) {
				case reflect.Interface, reflect.Slice, reflect.Array:
				default:
					return anyType, fmt.Errorf("cannot flatten %s", arg)
				}
			}

			return arrayType, nil
		},
	},
	{
		Name: "sort",
		Safe: func(args ...any) (any, uint, error) {
			if len(args) != 1 && len(args) != 2 {
				return nil, 0, fmt.Errorf("invalid number of arguments (expected 1 or 2, got %d)", len(args))
			}

			var array []any

			switch in := args[0].(type) {
			case []any:
				array = make([]any, len(in))
				copy(array, in)
			case []int:
				array = make([]any, len(in))
				for i, v := range in {
					array[i] = v
				}
			case []float64:
				array = make([]any, len(in))
				for i, v := range in {
					array[i] = v
				}
			case []string:
				array = make([]any, len(in))
				for i, v := range in {
					array[i] = v
				}
			}

			var desc bool
			if len(args) == 2 {
				switch args[1].(string) {
				case "asc":
					desc = false
				case "desc":
					desc = true
				default:
					return nil, 0, fmt.Errorf("invalid order %s, expected asc or desc", args[1])
				}
			}

			sortable := &runtime.Sort{
				Desc:  desc,
				Array: array,
			}
			sort.Sort(sortable)

			return sortable.Array, uint(len(array)), nil
		},
		Types: types(
			new(func([]any, string) []any),
			new(func([]int, string) []any),
			new(func([]float64, string) []any),
			new(func([]string, string) []any),

			new(func([]any) []any),
			new(func([]float64) []any),
			new(func([]string) []any),
			new(func([]int) []any),
		),
	},
	bitFunc("bitand", func(x, y int) (any, error) {
		return x & y, nil
	}),
	bitFunc("bitor", func(x, y int) (any, error) {
		return x | y, nil
	}),
	bitFunc("bitxor", func(x, y int) (any, error) {
		return x ^ y, nil
	}),
	bitFunc("bitnand", func(x, y int) (any, error) {
		return x &^ y, nil
	}),
	bitFunc("bitshl", func(x, y int) (any, error) {
		if y < 0 {
			return nil, fmt.Errorf("invalid operation: negative shift count %d (type int)", y)
		}
		return x << y, nil
	}),
	bitFunc("bitshr", func(x, y int) (any, error) {
		if y < 0 {
			return nil, fmt.Errorf("invalid operation: negative shift count %d (type int)", y)
		}
		return x >> y, nil
	}),
	bitFunc("bitushr", func(x, y int) (any, error) {
		if y < 0 {
			return nil, fmt.Errorf("invalid operation: negative shift count %d (type int)", y)
		}
		return int(uint(x) >> y), nil
	}),
	{
		Name: "bitnot",
		Func: func(args ...any) (any, error) {
			if len(args) != 1 {
				return nil, fmt.Errorf("invalid number of arguments for bitnot (expected 1, got %d)", len(args))
			}
			x, err := toInt(args[0])
			if err != nil {
				return nil, fmt.Errorf("%v to call bitnot", err)
			}
			return ^x, nil
		},
		Types: types(new(func(int) int)),
	},
}
