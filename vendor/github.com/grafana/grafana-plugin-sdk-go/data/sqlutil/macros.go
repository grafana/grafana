package sqlutil

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"golang.org/x/exp/maps"
)

var (
	// ErrorBadArgumentCount is returned from macros when the wrong number of arguments were provided
	ErrorBadArgumentCount = errors.New("unexpected number of arguments")
)

// MacroFunc defines a signature for applying a query macro
// Query macro implementations are defined by users/consumers of this package
type MacroFunc func(*Query, []string) (string, error)

// Macros is a map of macro name to MacroFunc. The name must be regex friendly.
type Macros map[string]MacroFunc

// Default macro to return interval
// Example:
//
// $__interval => "10m"
func macroInterval(query *Query, _ []string) (string, error) {
	return gtime.FormatInterval(query.Interval), nil
}

// Default macro to return interval in ms
// Example if $__interval is "10m":
//
// $__interval_ms => "600000"
func macroIntervalMS(query *Query, _ []string) (string, error) {
	return strconv.FormatInt(query.Interval.Milliseconds(), 10), nil
}

// Default time filter for SQL based on the query time range.
// It requires one argument, the time column to filter.
// Example:
//
//	$__timeFilter(time) => "time BETWEEN '2006-01-02T15:04:05Z07:00' AND '2006-01-02T15:04:05Z07:00'"
func macroTimeFilter(query *Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", ErrorBadArgumentCount, len(args))
	}

	var (
		column = args[0]
		from   = query.TimeRange.From.UTC().Format(time.RFC3339)
		to     = query.TimeRange.To.UTC().Format(time.RFC3339)
	)

	return fmt.Sprintf("%s >= '%s' AND %s <= '%s'", column, from, column, to), nil
}

// Default time filter for SQL based on the starting query time range.
// It requires one argument, the time column to filter.
// Example:
//
//	$__timeFrom(time) => "time > '2006-01-02T15:04:05Z07:00'"
func macroTimeFrom(query *Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", ErrorBadArgumentCount, len(args))
	}

	return fmt.Sprintf("%s >= '%s'", args[0], query.TimeRange.From.UTC().Format(time.RFC3339)), nil
}

// Default time filter for SQL based on the ending query time range.
// It requires one argument, the time column to filter.
// Example:
//
//	$__timeTo(time) => "time < '2006-01-02T15:04:05Z07:00'"
func macroTimeTo(query *Query, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", ErrorBadArgumentCount, len(args))
	}

	return fmt.Sprintf("%s <= '%s'", args[0], query.TimeRange.To.UTC().Format(time.RFC3339)), nil
}

// Default time group for SQL based the given period.
// This basic example is meant to be customized with more complex periods.
// It requires two arguments, the column to filter and the period.
// Example:
//
//	$__timeGroup(time, month) => "datepart(year, time), datepart(month, time)'"
func macroTimeGroup(_ *Query, args []string) (string, error) {
	if len(args) != 2 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", ErrorBadArgumentCount, len(args))
	}

	res := ""
	switch args[1] {
	case "minute":
		res += fmt.Sprintf("datepart(minute, %s),", args[0])
		fallthrough
	case "hour":
		res += fmt.Sprintf("datepart(hour, %s),", args[0])
		fallthrough
	case "day":
		res += fmt.Sprintf("datepart(day, %s),", args[0])
		fallthrough
	case "month":
		res += fmt.Sprintf("datepart(month, %s),", args[0])
		fallthrough
	case "year":
		res += fmt.Sprintf("datepart(year, %s)", args[0])
	}

	return res, nil
}

// Default macro to return the query table name.
// Example:
//
//	$__table => "my_table"
func macroTable(query *Query, _ []string) (string, error) {
	return query.Table, nil
}

// Default macro to return the query column name.
// Example:
//
//	$__column => "my_col"
func macroColumn(query *Query, _ []string) (string, error) {
	return query.Column, nil
}

var DefaultMacros = Macros{
	"interval":    macroInterval,
	"interval_ms": macroIntervalMS,
	"timeFilter":  macroTimeFilter,
	"timeFrom":    macroTimeFrom,
	"timeGroup":   macroTimeGroup,
	"timeTo":      macroTimeTo,
	"table":       macroTable,
	"column":      macroColumn,
}

type macroMatch struct {
	full string
	args []string
}

// getMacroMatches extracts macro strings with their respective arguments from the sql input given
// It manually parses the string to find the closing parenthesis of the macro (because regex has no memory)
func getMacroMatches(input string, name string) ([]macroMatch, error) {
	rgx, err := regexp.Compile(fmt.Sprintf(`\$__%s\b`, name))

	if err != nil {
		return nil, err
	}

	var matches []macroMatch
	for _, window := range rgx.FindAllStringIndex(input, -1) {
		start, end := window[0], window[1]
		args, length := parseArgs(input[end:])
		if length < 0 {
			return nil, fmt.Errorf("failed to parse macro arguments (missing close bracket?)")
		}
		matches = append(matches, macroMatch{full: input[start : end+length], args: args})
	}
	return matches, nil
}

// parseArgs looks for a bracketed argument list at the beginning of argString.
// If one is present, returns a list of whitespace-trimmed arguments and the
// length of the string comprising the bracketed argument list.
func parseArgs(argString string) ([]string, int) {
	if !strings.HasPrefix(argString, "(") {
		return nil, 0 // single empty arg for backwards compatibility
	}

	var args []string
	depth := 0
	arg := []rune{}

	for i, r := range argString {
		switch r {
		case '(':
			depth++
			if depth == 1 {
				// don't include the outer bracket in the arg
				continue
			}
		case ')':
			depth--
			if depth == 0 {
				// closing bracket
				args = append(args, strings.TrimSpace(string(arg)))
				return args, i + 1
			}
		case ',':
			if depth == 1 {
				// a comma at this level is separating args
				args = append(args, strings.TrimSpace(string(arg)))
				arg = []rune{}
				continue
			}
		}
		arg = append(arg, r)
	}
	// If we get here, we have seen an open bracket but not a close bracket. This
	// would formerly cause a panic; now it is treated as an error.
	return nil, -1
}

// Interpolate returns an interpolated query string given a backend.DataQuery
func Interpolate(query *Query, macros Macros) (string, error) {
	mergedMacros := Macros{}
	maps.Copy(mergedMacros, DefaultMacros)
	maps.Copy(mergedMacros, macros)
	// sort macros so longer macros are applied first to prevent it from being
	// overridden by a shorter macro that is a substring of the longer one
	sortedMacroKeys := make([]string, 0, len(mergedMacros))
	for key := range mergedMacros {
		sortedMacroKeys = append(sortedMacroKeys, key)
	}
	sort.Slice(sortedMacroKeys, func(i, j int) bool {
		return len(sortedMacroKeys[i]) > len(sortedMacroKeys[j])
	})

	rawSQL := query.RawSQL

	for _, key := range sortedMacroKeys {
		matches, err := getMacroMatches(rawSQL, key)
		if err != nil {
			return rawSQL, err
		}

		for _, match := range matches {
			macro := mergedMacros[key]
			res, err := macro(query.WithSQL(rawSQL), match.args)
			if err != nil {
				return rawSQL, err
			}

			rawSQL = strings.ReplaceAll(rawSQL, match.full, res)
		}
	}

	return rawSQL, nil
}
