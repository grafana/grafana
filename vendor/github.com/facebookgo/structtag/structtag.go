// Package structtag provides parsing of the defacto struct tag style.
package structtag

import (
	"errors"
	"strconv"
)

var errInvalidTag = errors.New("invalid tag")

// Extract the quoted value for the given name returning it if it is found. The
// found boolean helps differentiate between the "empty and found" vs "empty
// and not found" nature of default empty strings.
func Extract(name, tag string) (found bool, value string, err error) {
	for tag != "" {
		// skip leading space
		i := 0
		for i < len(tag) && tag[i] == ' ' {
			i++
		}
		tag = tag[i:]
		if tag == "" {
			break
		}

		// scan to colon.
		// a space or a quote is a syntax error
		i = 0
		for i < len(tag) && tag[i] != ' ' && tag[i] != ':' && tag[i] != '"' {
			i++
		}
		if i+1 >= len(tag) || tag[i] != ':' || tag[i+1] != '"' {
			return false, "", errInvalidTag
		}
		foundName := string(tag[:i])
		tag = tag[i+1:]

		// scan quoted string to find value
		i = 1
		for i < len(tag) && tag[i] != '"' {
			if tag[i] == '\\' {
				i++
			}
			i++
		}
		if i >= len(tag) {
			return false, "", errInvalidTag
		}
		qvalue := string(tag[:i+1])
		tag = tag[i+1:]

		if foundName == name {
			value, err := strconv.Unquote(qvalue)
			if err != nil {
				return false, "", err
			}
			return true, value, nil
		}
	}
	return false, "", nil
}
