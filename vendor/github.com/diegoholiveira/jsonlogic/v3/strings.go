package jsonlogic

import (
	"bytes"
	"strings"
)

func substr(values any) any {
	parsed := values.([]any)

	runes := []rune(toString(parsed[0]))

	from := int(toNumber(parsed[1]))
	length := len(runes)

	if from < 0 {
		from = length + from
	}

	if from < 0 || from > length {
		// case from is still negative, we must stop right now and return the original string
		return string(runes)
	}

	if len(parsed) == 3 {
		length = int(toNumber(parsed[2]))
	}

	var to int
	if length < 0 {
		length = len(runes) + length
		to = length
	} else {
		to = from + length
	}

	if to > len(runes) {
		to = len(runes)
	}

	return string(runes[from:to])
}

func concat(values any) any {
	if isString(values) {
		return values
	}

	var s bytes.Buffer
	for _, text := range values.([]any) {
		s.WriteString(toString(text))
	}

	return strings.TrimSpace(s.String())
}
