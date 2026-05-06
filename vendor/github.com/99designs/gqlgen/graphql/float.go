package graphql

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
)

func MarshalFloat(f float64) Marshaler {
	return WriterFunc(func(w io.Writer) {
		fmt.Fprintf(w, "%g", f)
	})
}

func UnmarshalFloat(v any) (float64, error) {
	switch v := v.(type) {
	case string:
		return strconv.ParseFloat(v, 64)
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case float64:
		return v, nil
	case json.Number:
		return strconv.ParseFloat(string(v), 64)
	case nil:
		return 0, nil
	default:
		return 0, fmt.Errorf("%T is not an float", v)
	}
}

func MarshalFloatContext(f float64) ContextMarshaler {
	return ContextWriterFunc(func(ctx context.Context, w io.Writer) error {
		if math.IsInf(f, 0) || math.IsNaN(f) {
			return errors.New("cannot marshal infinite no NaN float values")
		}
		fmt.Fprintf(w, "%g", f)
		return nil
	})
}

func UnmarshalFloatContext(ctx context.Context, v any) (float64, error) {
	return UnmarshalFloat(v)
}
