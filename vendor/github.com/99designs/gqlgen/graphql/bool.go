package graphql

import (
	"fmt"
	"io"
	"strconv"
	"strings"
)

func MarshalBoolean(b bool) Marshaler {
	str := strconv.FormatBool(b)
	return WriterFunc(func(w io.Writer) { w.Write([]byte(str)) })
}

func UnmarshalBoolean(v any) (bool, error) {
	switch v := v.(type) {
	case string:
		return strings.EqualFold(v, "true"), nil
	case int:
		return v != 0, nil
	case bool:
		return v, nil
	case nil:
		return false, nil
	default:
		return false, fmt.Errorf("%T is not a bool", v)
	}
}
