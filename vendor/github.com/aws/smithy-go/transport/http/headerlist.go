package http

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

func splitHeaderListValues(vs []string, splitFn func(string) ([]string, error)) ([]string, error) {
	values := make([]string, 0, len(vs))

	for i := 0; i < len(vs); i++ {
		parts, err := splitFn(vs[i])
		if err != nil {
			return nil, err
		}
		values = append(values, parts...)
	}

	return values, nil
}

// SplitHeaderListValues attempts to split the elements of the slice by commas,
// and return a list of all values separated. Returns error if unable to
// separate the values.
func SplitHeaderListValues(vs []string) ([]string, error) {
	return splitHeaderListValues(vs, quotedCommaSplit)
}

func quotedCommaSplit(v string) (parts []string, err error) {
	v = strings.TrimSpace(v)

	expectMore := true
	for i := 0; i < len(v); i++ {
		if unicode.IsSpace(rune(v[i])) {
			continue
		}
		expectMore = false

		// leading  space in part is ignored.
		// Start of value must be non-space, or quote.
		//
		// - If quote, enter quoted mode, find next non-escaped quote to
		//   terminate the value.
		// - Otherwise, find next comma to terminate value.

		remaining := v[i:]

		var value string
		var valueLen int
		if remaining[0] == '"' {
			//------------------------------
			// Quoted value
			//------------------------------
			var j int
			var skipQuote bool
			for j += 1; j < len(remaining); j++ {
				if remaining[j] == '\\' || (remaining[j] != '\\' && skipQuote) {
					skipQuote = !skipQuote
					continue
				}
				if remaining[j] == '"' {
					break
				}
			}
			if j == len(remaining) || j == 1 {
				return nil, fmt.Errorf("value %v missing closing double quote",
					remaining)
			}
			valueLen = j + 1

			tail := remaining[valueLen:]
			var k int
			for ; k < len(tail); k++ {
				if !unicode.IsSpace(rune(tail[k])) && tail[k] != ',' {
					return nil, fmt.Errorf("value %v has non-space trailing characters",
						remaining)
				}
				if tail[k] == ',' {
					expectMore = true
					break
				}
			}
			value = remaining[:valueLen]
			value, err = strconv.Unquote(value)
			if err != nil {
				return nil, fmt.Errorf("failed to unquote value %v, %w", value, err)
			}

			// Pad valueLen to include trailing space(s) so `i` is updated correctly.
			valueLen += k

		} else {
			//------------------------------
			// Unquoted value
			//------------------------------

			// Index of the next comma is the length of the value, or end of string.
			valueLen = strings.Index(remaining, ",")
			if valueLen != -1 {
				expectMore = true
			} else {
				valueLen = len(remaining)
			}
			value = strings.TrimSpace(remaining[:valueLen])
		}

		i += valueLen
		parts = append(parts, value)

	}

	if expectMore {
		parts = append(parts, "")
	}

	return parts, nil
}

// SplitHTTPDateTimestampHeaderListValues attempts to split the HTTP-Date
// timestamp values in the slice by commas, and return a list of all values
// separated. The split is aware of the HTTP-Date timestamp format, and will skip
// comma within the timestamp value. Returns an error if unable to split the
// timestamp values.
func SplitHTTPDateTimestampHeaderListValues(vs []string) ([]string, error) {
	return splitHeaderListValues(vs, splitHTTPDateHeaderValue)
}

func splitHTTPDateHeaderValue(v string) ([]string, error) {
	if n := strings.Count(v, ","); n <= 1 {
		// Nothing to do if only contains a no, or single HTTPDate value
		return []string{v}, nil
	} else if n%2 == 0 {
		return nil, fmt.Errorf("invalid timestamp HTTPDate header comma separations, %q", v)
	}

	var parts []string
	var i, j int

	var doSplit bool
	for ; i < len(v); i++ {
		if v[i] == ',' {
			if doSplit {
				doSplit = false
				parts = append(parts, strings.TrimSpace(v[j:i]))
				j = i + 1
			} else {
				// Skip the first comma in the timestamp value since that
				// separates the day from the rest of the timestamp.
				//
				// Tue, 17 Dec 2019 23:48:18 GMT
				doSplit = true
			}
		}
	}
	// Add final part
	if j < len(v) {
		parts = append(parts, strings.TrimSpace(v[j:]))
	}

	return parts, nil
}
