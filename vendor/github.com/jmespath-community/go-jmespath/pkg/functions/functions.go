package functions

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	jperror "github.com/jmespath-community/go-jmespath/pkg/error"
	"github.com/jmespath-community/go-jmespath/pkg/util"
)

type (
	JpFunction = func([]interface{}) (interface{}, error)
	ExpRef     = func(interface{}) (interface{}, error)
	JpType     string
)

const (
	JpNumber      JpType = "number"
	JpString      JpType = "string"
	JpArray       JpType = "array"
	JpObject      JpType = "object"
	JpArrayArray  JpType = "array[array]"
	JpArrayNumber JpType = "array[number]"
	JpArrayString JpType = "array[string]"
	JpExpref      JpType = "expref"
	JpAny         JpType = "any"
)

type FunctionEntry struct {
	Name      string
	Arguments []ArgSpec
	Handler   JpFunction
}

type ArgSpec struct {
	Types    []JpType
	Variadic bool
	Optional bool
}

type byExprString struct {
	items    []interface{}
	keys     []interface{}
	hasError bool
}

func (a *byExprString) Len() int {
	return len(a.items)
}

func (a *byExprString) Swap(i, j int) {
	a.items[i], a.items[j] = a.items[j], a.items[i]
	a.keys[i], a.keys[j] = a.keys[j], a.keys[i]
}

func (a *byExprString) Less(i, j int) bool {
	ith, ok := a.keys[i].(string)
	if !ok {
		a.hasError = true
		return true
	}
	jth, ok := a.keys[j].(string)
	if !ok {
		a.hasError = true
		return true
	}
	return ith < jth
}

type byExprFloat struct {
	items    []interface{}
	keys     []interface{}
	hasError bool
}

func (a *byExprFloat) Len() int {
	return len(a.items)
}

func (a *byExprFloat) Swap(i, j int) {
	a.items[i], a.items[j] = a.items[j], a.items[i]
	a.keys[i], a.keys[j] = a.keys[j], a.keys[i]
}

func (a *byExprFloat) Less(i, j int) bool {
	ith, ok := a.keys[i].(float64)
	if !ok {
		a.hasError = true
		return true
	}
	jth, ok := a.keys[j].(float64)
	if !ok {
		a.hasError = true
		return true
	}
	return ith < jth
}

func jpfAbs(arguments []interface{}) (interface{}, error) {
	num := arguments[0].(float64)
	return math.Abs(num), nil
}

func jpfAvg(arguments []interface{}) (interface{}, error) {
	// We've already type checked the value so we can safely use
	// type assertions.
	args := arguments[0].([]interface{})
	length := float64(len(args))
	if len(args) == 0 {
		return nil, nil
	}
	numerator := 0.0
	for _, n := range args {
		numerator += n.(float64)
	}
	return numerator / length, nil
}

func jpfCeil(arguments []interface{}) (interface{}, error) {
	val := arguments[0].(float64)
	return math.Ceil(val), nil
}

func jpfContains(arguments []interface{}) (interface{}, error) {
	search := arguments[0]
	el := arguments[1]
	if searchStr, ok := search.(string); ok {
		if elStr, ok := el.(string); ok {
			return strings.Contains(searchStr, elStr), nil
		}
		return false, nil
	}
	// Otherwise this is a generic contains for []interface{}
	general := search.([]interface{})
	for _, item := range general {
		if item == el {
			return true, nil
		}
	}
	return false, nil
}

func jpfEndsWith(arguments []interface{}) (interface{}, error) {
	search := arguments[0].(string)
	suffix := arguments[1].(string)
	return strings.HasSuffix(search, suffix), nil
}

func jpfFindImpl(name string, arguments []interface{}, find func(s string, substr string) int) (interface{}, error) {
	subject := arguments[0].(string)
	substr := arguments[1].(string)

	if len(subject) == 0 || len(substr) == 0 {
		return nil, nil
	}

	start := 0
	startSpecified := len(arguments) > 2
	if startSpecified {
		num, ok := util.ToInteger(arguments[2])
		if !ok {
			return nil, jperror.NotAnInteger(name, "start")
		}
		start = util.Max(0, num)
	}
	end := len(subject)
	endSpecified := len(arguments) > 3
	if endSpecified {
		num, ok := util.ToInteger(arguments[3])
		if !ok {
			return nil, jperror.NotAnInteger(name, "end")
		}
		end = util.Min(num, len(subject))
	}

	offset := find(subject[start:end], substr)

	if offset == -1 {
		return nil, nil
	}

	return float64(start + offset), nil
}

func jpfFindFirst(arguments []interface{}) (interface{}, error) {
	return jpfFindImpl("find_first", arguments, strings.Index)
}

func jpfFindLast(arguments []interface{}) (interface{}, error) {
	return jpfFindImpl("find_last", arguments, strings.LastIndex)
}

func jpfFloor(arguments []interface{}) (interface{}, error) {
	val := arguments[0].(float64)
	return math.Floor(val), nil
}

func jpfFromItems(arguments []interface{}) (interface{}, error) {
	if arr, ok := util.ToArrayArray(arguments[0]); ok {
		result := make(map[string]interface{})
		for _, item := range arr {
			if len(item) != 2 {
				return nil, errors.New("invalid value, each array must contain two elements, a pair of string and value")
			}
			first, ok := item[0].(string)
			if !ok {
				return nil, errors.New("invalid value, each array must contain two elements, a pair of string and value")
			}
			second := item[1]
			result[first] = second
		}
		return result, nil
	}
	return nil, errors.New("invalid type, first argument must be an array of arrays")
}

func jpfGroupBy(arguments []interface{}) (interface{}, error) {
	arr := arguments[0].([]interface{})
	exp := arguments[1].(ExpRef)
	if len(arr) == 0 {
		return nil, nil
	}
	groups := map[string]interface{}{}
	for _, element := range arr {
		spec, err := exp(element)
		if err != nil {
			return nil, err
		}
		key, ok := spec.(string)
		if !ok {
			return nil, errors.New("invalid type, the expression must evaluate to a string")
		}
		if _, ok := groups[key]; !ok {
			groups[key] = []interface{}{}
		}
		groups[key] = append(groups[key].([]interface{}), element)
	}
	return groups, nil
}

func jpfItems(arguments []interface{}) (interface{}, error) {
	value := arguments[0].(map[string]interface{})
	arrays := []interface{}{}
	for key, item := range value {
		var element interface{} = []interface{}{key, item}
		arrays = append(arrays, element)
	}

	return arrays, nil
}

func jpfJoin(arguments []interface{}) (interface{}, error) {
	sep := arguments[0].(string)
	// We can't just do arguments[1].([]string), we have to
	// manually convert each item to a string.
	arrayStr := []string{}
	for _, item := range arguments[1].([]interface{}) {
		arrayStr = append(arrayStr, item.(string))
	}
	return strings.Join(arrayStr, sep), nil
}

func jpfKeys(arguments []interface{}) (interface{}, error) {
	arg := arguments[0].(map[string]interface{})
	collected := make([]interface{}, 0, len(arg))
	for key := range arg {
		collected = append(collected, key)
	}
	return collected, nil
}

func jpfLength(arguments []interface{}) (interface{}, error) {
	arg := arguments[0]
	if c, ok := arg.(string); ok {
		return float64(utf8.RuneCountInString(c)), nil
	} else if util.IsSliceType(arg) {
		v := reflect.ValueOf(arg)
		return float64(v.Len()), nil
	} else if c, ok := arg.(map[string]interface{}); ok {
		return float64(len(c)), nil
	}
	return nil, errors.New("could not compute length()")
}

func jpfLower(arguments []interface{}) (interface{}, error) {
	return strings.ToLower(arguments[0].(string)), nil
}

func jpfMap(arguments []interface{}) (interface{}, error) {
	exp := arguments[0].(ExpRef)
	arr := arguments[1].([]interface{})
	mapped := make([]interface{}, 0, len(arr))
	for _, value := range arr {
		current, err := exp(value)
		if err != nil {
			return nil, err
		}
		mapped = append(mapped, current)
	}
	return mapped, nil
}

func jpfMax(arguments []interface{}) (interface{}, error) {
	if items, ok := util.ToArrayNum(arguments[0]); ok {
		if len(items) == 0 {
			return nil, nil
		}
		if len(items) == 1 {
			return items[0], nil
		}
		best := items[0]
		for _, item := range items[1:] {
			if item > best {
				best = item
			}
		}
		return best, nil
	}
	// Otherwise we're dealing with a max() of strings.
	items, _ := util.ToArrayStr(arguments[0])
	if len(items) == 0 {
		return nil, nil
	}
	if len(items) == 1 {
		return items[0], nil
	}
	best := items[0]
	for _, item := range items[1:] {
		if item > best {
			best = item
		}
	}
	return best, nil
}

func jpfMaxBy(arguments []interface{}) (interface{}, error) {
	arr := arguments[0].([]interface{})
	exp := arguments[1].(ExpRef)
	if len(arr) == 0 {
		return nil, nil
	} else if len(arr) == 1 {
		return arr[0], nil
	}
	start, err := exp(arr[0])
	if err != nil {
		return nil, err
	}
	switch t := start.(type) {
	case float64:
		bestVal := t
		bestItem := arr[0]
		for _, item := range arr[1:] {
			result, err := exp(item)
			if err != nil {
				return nil, err
			}
			current, ok := result.(float64)
			if !ok {
				return nil, errors.New("invalid type, must be number")
			}
			if current > bestVal {
				bestVal = current
				bestItem = item
			}
		}
		return bestItem, nil
	case string:
		bestVal := t
		bestItem := arr[0]
		for _, item := range arr[1:] {
			result, err := exp(item)
			if err != nil {
				return nil, err
			}
			current, ok := result.(string)
			if !ok {
				return nil, errors.New("invalid type, must be string")
			}
			if current > bestVal {
				bestVal = current
				bestItem = item
			}
		}
		return bestItem, nil
	default:
		return nil, errors.New("invalid type, must be number of string")
	}
}

func jpfMerge(arguments []interface{}) (interface{}, error) {
	final := make(map[string]interface{})
	for _, m := range arguments {
		mapped := m.(map[string]interface{})
		for key, value := range mapped {
			final[key] = value
		}
	}
	return final, nil
}

func jpfMin(arguments []interface{}) (interface{}, error) {
	if items, ok := util.ToArrayNum(arguments[0]); ok {
		if len(items) == 0 {
			return nil, nil
		}
		if len(items) == 1 {
			return items[0], nil
		}
		best := items[0]
		for _, item := range items[1:] {
			if item < best {
				best = item
			}
		}
		return best, nil
	}
	items, _ := util.ToArrayStr(arguments[0])
	if len(items) == 0 {
		return nil, nil
	}
	if len(items) == 1 {
		return items[0], nil
	}
	best := items[0]
	for _, item := range items[1:] {
		if item < best {
			best = item
		}
	}
	return best, nil
}

func jpfMinBy(arguments []interface{}) (interface{}, error) {
	arr := arguments[0].([]interface{})
	exp := arguments[1].(ExpRef)
	if len(arr) == 0 {
		return nil, nil
	} else if len(arr) == 1 {
		return arr[0], nil
	}
	start, err := exp(arr[0])
	if err != nil {
		return nil, err
	}
	if t, ok := start.(float64); ok {
		bestVal := t
		bestItem := arr[0]
		for _, item := range arr[1:] {
			result, err := exp(item)
			if err != nil {
				return nil, err
			}
			current, ok := result.(float64)
			if !ok {
				return nil, errors.New("invalid type, must be number")
			}
			if current < bestVal {
				bestVal = current
				bestItem = item
			}
		}
		return bestItem, nil
	} else if t, ok := start.(string); ok {
		bestVal := t
		bestItem := arr[0]
		for _, item := range arr[1:] {
			result, err := exp(item)
			if err != nil {
				return nil, err
			}
			current, ok := result.(string)
			if !ok {
				return nil, errors.New("invalid type, must be string")
			}
			if current < bestVal {
				bestVal = current
				bestItem = item
			}
		}
		return bestItem, nil
	} else {
		return nil, errors.New("invalid type, must be number of string")
	}
}

func jpfNotNull(arguments []interface{}) (interface{}, error) {
	for _, arg := range arguments {
		if arg != nil {
			return arg, nil
		}
	}
	return nil, nil
}

func jpfPadImpl(
	name string,
	arguments []interface{},
	pad func(s string, width int, pad string) string,
) (interface{}, error) {
	s := arguments[0].(string)
	width, ok := util.ToPositiveInteger(arguments[1])
	if !ok {
		return nil, jperror.NotAPositiveInteger(name, "width")
	}
	chars := " "
	if len(arguments) > 2 {
		chars = arguments[2].(string)
		if len(chars) > 1 {
			return nil, fmt.Errorf("invalid value, the function '%s' expects its 'pad' argument to be a string of length 1", name)
		}
	}

	return pad(s, width, chars), nil
}

func jpfPadLeft(arguments []interface{}) (interface{}, error) {
	return jpfPadImpl("pad_left", arguments, padLeft)
}

func jpfPadRight(arguments []interface{}) (interface{}, error) {
	return jpfPadImpl("pad_right", arguments, padRight)
}

func padLeft(s string, width int, pad string) string {
	length := util.Max(0, width-len(s))
	padding := strings.Repeat(pad, length)
	result := fmt.Sprintf("%s%s", padding, s)
	return result
}

func padRight(s string, width int, pad string) string {
	length := util.Max(0, width-len(s))
	padding := strings.Repeat(pad, length)
	result := fmt.Sprintf("%s%s", s, padding)
	return result
}

func jpfReplace(arguments []interface{}) (interface{}, error) {
	subject := arguments[0].(string)
	old := arguments[1].(string)
	new := arguments[2].(string)
	count := -1
	if len(arguments) > 3 {
		num, ok := util.ToPositiveInteger(arguments[3])
		if !ok {
			return nil, jperror.NotAPositiveInteger("replace", "count")
		}
		count = num
	}

	return strings.Replace(subject, old, new, count), nil
}

func jpfReverse(arguments []interface{}) (interface{}, error) {
	if s, ok := arguments[0].(string); ok {
		r := []rune(s)
		for i, j := 0, len(r)-1; i < len(r)/2; i, j = i+1, j-1 {
			r[i], r[j] = r[j], r[i]
		}
		return string(r), nil
	}
	items := arguments[0].([]interface{})
	length := len(items)
	reversed := make([]interface{}, length)
	for i, item := range items {
		reversed[length-(i+1)] = item
	}
	return reversed, nil
}

func jpfSort(arguments []interface{}) (interface{}, error) {
	if items, ok := util.ToArrayNum(arguments[0]); ok {
		d := sort.Float64Slice(items)
		sort.Stable(d)
		final := make([]interface{}, len(d))
		for i, val := range d {
			final[i] = val
		}
		return final, nil
	}
	// Otherwise we're dealing with sort()'ing strings.
	items, _ := util.ToArrayStr(arguments[0])
	d := sort.StringSlice(items)
	sort.Stable(d)
	final := make([]interface{}, len(d))
	for i, val := range d {
		final[i] = val
	}
	return final, nil
}

func jpfSortBy(arguments []interface{}) (interface{}, error) {
	arr := arguments[0].([]interface{})
	exp := arguments[1].(ExpRef)
	if len(arr) == 0 {
		return arr, nil
	} else if len(arr) == 1 {
		return arr, nil
	}
	var sortKeys []interface{}
	for _, item := range arr {
		if value, err := exp(item); err != nil {
			return nil, err
		} else {
			sortKeys = append(sortKeys, value)
		}
	}
	if _, ok := sortKeys[0].(float64); ok {
		sortable := &byExprFloat{arr, sortKeys, false}
		sort.Stable(sortable)
		if sortable.hasError {
			return nil, errors.New("error in sort_by comparison")
		}
		return arr, nil
	} else if _, ok := sortKeys[0].(string); ok {
		sortable := &byExprString{arr, sortKeys, false}
		sort.Stable(sortable)
		if sortable.hasError {
			return nil, errors.New("error in sort_by comparison")
		}
		return arr, nil
	} else {
		return nil, errors.New("invalid type, must be number of string")
	}
}

func jpfSplit(arguments []interface{}) (interface{}, error) {
	s := arguments[0].(string)
	if len(s) == 0 {
		return []interface{}{}, nil
	}

	sep := arguments[1].(string)
	n := 0
	nSpecified := len(arguments) > 2
	if nSpecified {
		num, ok := util.ToPositiveInteger(arguments[2])
		if !ok {
			return nil, jperror.NotAPositiveInteger("split", "count")
		}
		n = num
	}

	if nSpecified && n == 0 {
		result := []interface{}{s}
		return result, nil
	}

	count := -1
	if nSpecified {
		count = n + 1
	}
	splits := strings.SplitN(s, sep, count)

	// convert []string to []interface{} ☹️

	result := []interface{}{}
	for _, split := range splits {
		result = append(result, split)
	}
	return result, nil
}

func jpfStartsWith(arguments []interface{}) (interface{}, error) {
	search := arguments[0].(string)
	prefix := arguments[1].(string)
	return strings.HasPrefix(search, prefix), nil
}

func jpfSum(arguments []interface{}) (interface{}, error) {
	items, _ := util.ToArrayNum(arguments[0])
	sum := 0.0
	for _, item := range items {
		sum += item
	}
	return sum, nil
}

func jpfToArray(arguments []interface{}) (interface{}, error) {
	if _, ok := arguments[0].([]interface{}); ok {
		return arguments[0], nil
	}
	return arguments[:1:1], nil
}

func jpfToString(arguments []interface{}) (interface{}, error) {
	if v, ok := arguments[0].(string); ok {
		return v, nil
	}
	result, err := json.Marshal(arguments[0])
	if err != nil {
		return nil, err
	}
	return string(result), nil
}

func jpfToNumber(arguments []interface{}) (interface{}, error) {
	arg := arguments[0]
	if v, ok := arg.(float64); ok {
		return v, nil
	}
	if v, ok := arg.(string); ok {
		conv, err := strconv.ParseFloat(v, 64)
		if err != nil {
			return nil, nil
		}
		return conv, nil
	}
	if _, ok := arg.([]interface{}); ok {
		return nil, nil
	}
	if _, ok := arg.(map[string]interface{}); ok {
		return nil, nil
	}
	if arg == nil {
		return nil, nil
	}
	if arg == true || arg == false {
		return nil, nil
	}
	return nil, errors.New("unknown type")
}

func jpfTrimImpl(
	arguments []interface{},
	trimSpace func(s string, predicate func(r rune) bool) string,
	trim func(s string, cutset string) string,
) (interface{}, error) {
	s := arguments[0].(string)
	cutset := ""
	if len(arguments) > 1 {
		cutset = arguments[1].(string)
	}

	if len(cutset) == 0 {
		return trimSpace(s, unicode.IsSpace), nil
	}
	return trim(s, cutset), nil
}

func jpfTrim(arguments []interface{}) (interface{}, error) {
	return jpfTrimImpl(arguments, strings.TrimFunc, strings.Trim)
}

func jpfTrimLeft(arguments []interface{}) (interface{}, error) {
	return jpfTrimImpl(arguments, strings.TrimLeftFunc, strings.TrimLeft)
}

func jpfTrimRight(arguments []interface{}) (interface{}, error) {
	return jpfTrimImpl(arguments, strings.TrimRightFunc, strings.TrimRight)
}

func jpfType(arguments []interface{}) (interface{}, error) {
	arg := arguments[0]
	if _, ok := arg.(float64); ok {
		return "number", nil
	}
	if _, ok := arg.(string); ok {
		return "string", nil
	}
	if _, ok := arg.([]interface{}); ok {
		return "array", nil
	}
	if _, ok := arg.(map[string]interface{}); ok {
		return "object", nil
	}
	if arg == nil {
		return "null", nil
	}
	if arg == true || arg == false {
		return "boolean", nil
	}
	return nil, errors.New("unknown type")
}

func jpfUpper(arguments []interface{}) (interface{}, error) {
	return strings.ToUpper(arguments[0].(string)), nil
}

func jpfValues(arguments []interface{}) (interface{}, error) {
	arg := arguments[0].(map[string]interface{})
	collected := make([]interface{}, 0, len(arg))
	for _, value := range arg {
		collected = append(collected, value)
	}
	return collected, nil
}

func jpfZip(arguments []interface{}) (interface{}, error) {
	// determine how many items are present
	// for each array in the result

	count := math.MaxInt
	for _, item := range arguments {
		arr := item.([]interface{})
		// TODO: use go1.18 min[T constraints.Ordered] generic function
		count = int(math.Min(float64(count), float64(len(arr))))
	}

	result := []interface{}{}

	for i := 0; i < count; i++ {
		nth := []interface{}{}
		for _, item := range arguments {
			arr := item.([]interface{})
			nth = append(nth, arr[i])
		}
		result = append(result, interface{}(nth))
	}

	return result, nil
}
