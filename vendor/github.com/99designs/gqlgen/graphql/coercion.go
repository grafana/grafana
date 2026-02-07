package graphql

import (
	"encoding/json"
)

// CoerceList applies coercion from a single value to a list.
func CoerceList(v any) []any {
	var vSlice []any
	if v == nil {
		return vSlice
	}

	switch v := v.(type) {
	case []any:
		// already a slice no coercion required
		vSlice = v
	case []string:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []json.Number:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []bool:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []map[string]any:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []float64:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []float32:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []int:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []int32:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	case []int64:
		if len(v) > 0 {
			vSlice = []any{v[0]}
		}
	default:
		vSlice = []any{v}
	}
	return vSlice
}
