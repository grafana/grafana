package tools

func AnyToInt64(value any) int64 {
	switch v := value.(type) {
	case int:
		return int64(v)
	case int8:
		return int64(v)
	case int16:
		return int64(v)
	case int32:
		return int64(v)
	case int64:
		return v

	case float32:
		return int64(v)
	case float64:
		return int64(v)
	}

	return value.(int64)
}

func ToPtr[T any](v T) *T {
	return &v
}
