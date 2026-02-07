package receivers

import (
	"strconv"
	"strings"
)

// OptionalNumber represents a string that may be a number. It implements a special JSON decoder to accept either a string or a number.
// The difference from json.Number implementation is that it supports empty string. The json.Number fails if the field is an empty string.
// The reason we need this is that some notifiers used to accept strings as numbers (even invalid and empty strings), and treated all non-numbers as 0 (see simplejson).
// This implementation will not allow invalid strings but still more relaxed than json.Number or int64. It will be removed in the future
type OptionalNumber string

func (o OptionalNumber) String() string {
	return string(o)
}

// Int64 returns the number as an int64. If string is empty, it returns 0.
func (o OptionalNumber) Int64() (int64, error) {
	if string(o) == "" {
		return 0, nil
	}
	return strconv.ParseInt(string(o), 10, 64)
}

func (o *OptionalNumber) UnmarshalJSON(bytes []byte) error {
	str := string(bytes)
	*o = OptionalNumber(strings.Trim(str, "\""))
	return nil
}
