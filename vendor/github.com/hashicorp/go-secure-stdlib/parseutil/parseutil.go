// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package parseutil

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/go-secure-stdlib/strutil"
	sockaddr "github.com/hashicorp/go-sockaddr"
	"github.com/mitchellh/mapstructure"
)

var (
	validCapacityString               = regexp.MustCompile("^[\t ]*([0-9]+)[\t ]?([kmgtKMGT][iI]?[bB])?[\t ]*$")
	ErrDurationMultiplicationOverflow = errors.New("multiplication of durations resulted in overflow, one operand may be too large")
)

// ParseCapacityString parses a capacity string and returns the number of bytes it represents.
// Capacity strings are things like 5gib or 10MB. Supported prefixes are kb, kib, mb, mib, gb,
// gib, tb, tib, which are not case sensitive. If no prefix is present, the number is assumed
// to be in bytes already.
func ParseCapacityString(in interface{}) (uint64, error) {
	var cap uint64

	jsonIn, ok := in.(json.Number)
	if ok {
		in = jsonIn.String()
	}

	switch inp := in.(type) {
	case nil:
		// return default of zero
	case string:
		if inp == "" {
			return cap, nil
		}

		matches := validCapacityString.FindStringSubmatch(inp)

		// no sub-groups means we couldn't parse it
		if len(matches) <= 1 {
			return cap, errors.New("could not parse capacity from input")
		}

		var multiplier uint64 = 1
		switch strings.ToLower(matches[2]) {
		case "kb":
			multiplier = 1000
		case "kib":
			multiplier = 1024
		case "mb":
			multiplier = 1000 * 1000
		case "mib":
			multiplier = 1024 * 1024
		case "gb":
			multiplier = 1000 * 1000 * 1000
		case "gib":
			multiplier = 1024 * 1024 * 1024
		case "tb":
			multiplier = 1000 * 1000 * 1000 * 1000
		case "tib":
			multiplier = 1024 * 1024 * 1024 * 1024
		}

		size, err := strconv.ParseUint(matches[1], 10, 64)
		if err != nil {
			return cap, err
		}

		cap = size * multiplier
	case int:
		cap = uint64(inp)
	case int32:
		cap = uint64(inp)
	case int64:
		cap = uint64(inp)
	case uint:
		cap = uint64(inp)
	case uint32:
		cap = uint64(inp)
	case uint64:
		cap = uint64(inp)
	case float32:
		cap = uint64(inp)
	case float64:
		cap = uint64(inp)
	default:
		return cap, errors.New("could not parse capacity from input")
	}

	return cap, nil
}

// Parse a duration from an arbitrary value (a string or numeric value) into
// a time.Duration; when units are missing (such as when a numeric type is
// provided), the duration is assumed to be in seconds.
func ParseDurationSecond(in interface{}) (time.Duration, error) {
	var dur time.Duration
	jsonIn, ok := in.(json.Number)
	if ok {
		in = jsonIn.String()
	}
	var err error
	switch inp := in.(type) {
	case nil:
		// return default of zero
	case string:
		if inp == "" {
			return dur, nil
		}

		if v, err := strconv.ParseInt(inp, 10, 64); err == nil {
			return overflowMul(time.Duration(v), time.Second)
		}

		if strings.HasSuffix(inp, "d") {
			v, err := strconv.ParseInt(inp[:len(inp)-1], 10, 64)
			if err != nil {
				return dur, err
			}
			return overflowMul(time.Duration(v), 24*time.Hour)
		}

		var err error
		if dur, err = time.ParseDuration(inp); err != nil {
			return dur, err
		}
	case int:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case int32:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case int64:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case uint:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case uint32:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case uint64:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case float32:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case float64:
		dur, err = overflowMul(time.Duration(inp), time.Second)
	case time.Duration:
		dur = inp
	default:
		return 0, errors.New("could not parse duration from input")
	}
	if err != nil {
		dur = time.Duration(0)
	}
	return dur, err
}

// Multiplication of durations could overflow, this performs multiplication while erroring out if an overflow occurs
func overflowMul(a time.Duration, b time.Duration) (time.Duration, error) {
	x := a * b
	if a != 0 && x/a != b {
		return time.Duration(0), ErrDurationMultiplicationOverflow
	}
	return x, nil
}

// Parse an absolute timestamp from the provided arbitrary value (string or
// numeric value). When an untyped numeric value is provided, it is assumed
// to be seconds from the Unix Epoch.
func ParseAbsoluteTime(in interface{}) (time.Time, error) {
	var t time.Time
	switch inp := in.(type) {
	case nil:
		// return default of zero
		return t, nil
	case string:
		// Allow RFC3339 with nanoseconds, or without,
		// or an epoch time as an integer.
		var err error
		t, err = time.Parse(time.RFC3339Nano, inp)
		if err == nil {
			break
		}
		t, err = time.Parse(time.RFC3339, inp)
		if err == nil {
			break
		}
		epochTime, err := strconv.ParseInt(inp, 10, 64)
		if err == nil {
			t = time.Unix(epochTime, 0)
			break
		}
		return t, errors.New("could not parse string as date and time")
	case json.Number:
		epochTime, err := inp.Int64()
		if err != nil {
			return t, err
		}
		t = time.Unix(epochTime, 0)
	case int:
		t = time.Unix(int64(inp), 0)
	case int32:
		t = time.Unix(int64(inp), 0)
	case int64:
		t = time.Unix(inp, 0)
	case uint:
		t = time.Unix(int64(inp), 0)
	case uint32:
		t = time.Unix(int64(inp), 0)
	case uint64:
		t = time.Unix(int64(inp), 0)
	default:
		return t, errors.New("could not parse time from input type")
	}
	return t, nil
}

// ParseInt takes an arbitrary value (either a string or numeric type) and
// parses it as an int64 value. This value is assumed to be larger than the
// provided type, but cannot safely be cast.
//
// When the end value is bounded (such as an int value), it is recommended
// to instead call SafeParseInt or SafeParseIntRange to safely cast to a
// more restrictive type.
func ParseInt(in interface{}) (int64, error) {
	var ret int64
	jsonIn, ok := in.(json.Number)
	if ok {
		in = jsonIn.String()
	}
	switch in.(type) {
	case string:
		inp := in.(string)
		if inp == "" {
			return 0, nil
		}
		var err error
		left, err := strconv.ParseInt(inp, 10, 64)
		if err != nil {
			return ret, err
		}
		ret = left
	case int:
		ret = int64(in.(int))
	case int32:
		ret = int64(in.(int32))
	case int64:
		ret = in.(int64)
	case uint:
		ret = int64(in.(uint))
	case uint32:
		ret = int64(in.(uint32))
	case uint64:
		ret = int64(in.(uint64))
	default:
		return 0, errors.New("could not parse value from input")
	}

	return ret, nil
}

// ParseDirectIntSlice behaves similarly to ParseInt, but accepts typed
// slices, returning a slice of int64s.
//
// If the starting value may not be in slice form (e.g.. a bare numeric value
// could be provided), it is suggested to call ParseIntSlice instead.
func ParseDirectIntSlice(in interface{}) ([]int64, error) {
	var ret []int64

	switch in.(type) {
	case []int:
		for _, v := range in.([]int) {
			ret = append(ret, int64(v))
		}
	case []int32:
		for _, v := range in.([]int32) {
			ret = append(ret, int64(v))
		}
	case []int64:
		// For consistency to ensure callers can always modify ret without
		// impacting in.
		for _, v := range in.([]int64) {
			ret = append(ret, v)
		}
	case []uint:
		for _, v := range in.([]uint) {
			ret = append(ret, int64(v))
		}
	case []uint32:
		for _, v := range in.([]uint32) {
			ret = append(ret, int64(v))
		}
	case []uint64:
		for _, v := range in.([]uint64) {
			ret = append(ret, int64(v))
		}
	case []json.Number:
		for _, v := range in.([]json.Number) {
			element, err := ParseInt(v)
			if err != nil {
				return nil, err
			}
			ret = append(ret, element)
		}
	case []string:
		for _, v := range in.([]string) {
			element, err := ParseInt(v)
			if err != nil {
				return nil, err
			}
			ret = append(ret, element)
		}
	default:
		return nil, errors.New("could not parse value from input")
	}

	return ret, nil
}

// ParseIntSlice is a helper function for handling upgrades of optional
// slices; that is, if the API accepts a type similar to <int|[]int>,
// nicely handle the common cases of providing only an int-ish, providing
// an actual slice of int-ishes, or providing a comma-separated list of
// numbers.
//
// When []int64 is not the desired final type (or the values should be
// range-bound), it is suggested to call SafeParseIntSlice or
// SafeParseIntSliceRange instead.
func ParseIntSlice(in interface{}) ([]int64, error) {
	if ret, err := ParseInt(in); err == nil {
		return []int64{ret}, nil
	}

	if ret, err := ParseDirectIntSlice(in); err == nil {
		return ret, nil
	}

	if strings, err := ParseCommaStringSlice(in); err == nil {
		var ret []int64
		for _, v := range strings {
			if v == "" {
				// Ignore empty fields
				continue
			}

			element, err := ParseInt(v)
			if err != nil {
				return nil, err
			}
			ret = append(ret, element)
		}

		return ret, nil
	}

	return nil, errors.New("could not parse value from input")
}

// Parses the provided arbitrary value as a boolean-like value.
func ParseBool(in interface{}) (bool, error) {
	var result bool
	if err := mapstructure.WeakDecode(in, &result); err != nil {
		return false, err
	}
	return result, nil
}

// Parses the provided arbitrary value as a string.
func ParseString(in interface{}) (string, error) {
	var result string
	if err := mapstructure.WeakDecode(in, &result); err != nil {
		return "", err
	}
	return result, nil
}

// Parses the provided string-like value as a comma-separated list of values.
func ParseCommaStringSlice(in interface{}) ([]string, error) {
	jsonIn, ok := in.(json.Number)
	if ok {
		in = jsonIn.String()
	}

	rawString, ok := in.(string)
	if ok && rawString == "" {
		return []string{}, nil
	}
	var result []string
	config := &mapstructure.DecoderConfig{
		Result:           &result,
		WeaklyTypedInput: true,
		DecodeHook:       mapstructure.StringToSliceHookFunc(","),
	}
	decoder, err := mapstructure.NewDecoder(config)
	if err != nil {
		return nil, err
	}
	if err := decoder.Decode(in); err != nil {
		return nil, err
	}
	return strutil.TrimStrings(result), nil
}

// Parses the specified value as one or more addresses, separated by commas.
func ParseAddrs(addrs interface{}) ([]*sockaddr.SockAddrMarshaler, error) {
	out := make([]*sockaddr.SockAddrMarshaler, 0)
	stringAddrs := make([]string, 0)

	switch addrs.(type) {
	case string:
		stringAddrs = strutil.ParseArbitraryStringSlice(addrs.(string), ",")
		if len(stringAddrs) == 0 {
			return nil, fmt.Errorf("unable to parse addresses from %v", addrs)
		}

	case []string:
		stringAddrs = addrs.([]string)

	case []interface{}:
		for _, v := range addrs.([]interface{}) {
			stringAddr, ok := v.(string)
			if !ok {
				return nil, fmt.Errorf("error parsing %v as string", v)
			}
			stringAddrs = append(stringAddrs, stringAddr)
		}

	default:
		return nil, fmt.Errorf("unknown address input type %T", addrs)
	}

	for _, addr := range stringAddrs {
		sa, err := sockaddr.NewSockAddr(addr)
		if err != nil {
			return nil, fmt.Errorf("error parsing address %q: %w", addr, err)
		}
		out = append(out, &sockaddr.SockAddrMarshaler{
			SockAddr: sa,
		})
	}

	return out, nil
}

// Parses the provided arbitrary value (see ParseInt), ensuring it is within
// the specified range (inclusive of bounds). If this range corresponds to a
// smaller type, the returned value can then be safely cast without risking
// overflow.
func SafeParseIntRange(in interface{}, min int64, max int64) (int64, error) {
	raw, err := ParseInt(in)
	if err != nil {
		return 0, err
	}

	if raw < min || raw > max {
		return 0, fmt.Errorf("error parsing int value; out of range [%v to %v]: %v", min, max, raw)
	}

	return raw, nil
}

// Parses the specified arbitrary value (see ParseInt), ensuring that the
// resulting value is within the range for an int value. If no error occurred,
// the caller knows no overflow occurred.
func SafeParseInt(in interface{}) (int, error) {
	raw, err := SafeParseIntRange(in, math.MinInt, math.MaxInt)
	return int(raw), err
}

// Parses the provided arbitrary value (see ParseIntSlice) into a slice of
// int64 values, ensuring each is within the specified range (inclusive of
// bounds). If this range corresponds to a smaller type, the returned value
// can then be safely cast without risking overflow.
//
// If elements is positive, it is used to ensure the resulting slice is
// bounded above by that many number of elements (inclusive).
func SafeParseIntSliceRange(in interface{}, minValue int64, maxValue int64, elements int) ([]int64, error) {
	raw, err := ParseIntSlice(in)
	if err != nil {
		return nil, err
	}

	if elements > 0 && len(raw) > elements {
		return nil, fmt.Errorf("error parsing value from input: got %v but expected at most %v elements", len(raw), elements)
	}

	for index, value := range raw {
		if value < minValue || value > maxValue {
			return nil, fmt.Errorf("error parsing value from input: element %v was outside of range [%v to %v]: %v", index, minValue, maxValue, value)
		}
	}

	return raw, nil
}

// Parses the provided arbitrary value (see ParseIntSlice) into a slice of
// int values, ensuring the each resulting value in the slice is within the
// range for an int value. If no error occurred, the caller knows no overflow
// occurred.
//
// If elements is positive, it is used to ensure the resulting slice is
// bounded above by that many number of elements (inclusive).
func SafeParseIntSlice(in interface{}, elements int) ([]int, error) {
	raw, err := SafeParseIntSliceRange(in, math.MinInt, math.MaxInt, elements)
	if err != nil || raw == nil {
		return nil, err
	}

	var result = make([]int, 0, len(raw))
	for _, element := range raw {
		result = append(result, int(element))
	}

	return result, nil
}
