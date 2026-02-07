// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package parseutil

import (
	"errors"
	"fmt"
	"io/ioutil"
	"net/url"
	"os"
	"strings"
)

var (
	ErrNotAUrl   = errors.New("not a url")
	ErrNotParsed = errors.New("not a parsed value")
)

type options struct {
	errorOnMissingEnv bool
	noTrimSpaces      bool
}

type option func() optionFunc

type optionFunc func(*options)

// ParsePath parses a URL with schemes file://, env://, or any other. Depending
// on the scheme it will return specific types of data:
//
// * file:// will return a string with the file's contents
//
// * env:// will return a string with the env var's contents
//
// * Anything else will return the string as it was. Functionally this means
// anything for which Go's `url.Parse` function does not throw an error. If you
// want to ensure that this function errors if a known scheme is not found, use
// MustParsePath.
//
// On error, we return the original string along with the error. The caller can
// switch on errors.Is(err, ErrNotAUrl) to understand whether it was the parsing
// step that errored or something else (such as a file not found). This is
// useful to attempt to read a non-URL string from some resource, but where the
// original input may simply be a valid string of that type.
func ParsePath(path string, options ...option) (string, error) {
	return parsePath(path, false, options)
}

// MustParsePath behaves like ParsePath but will return ErrNotAUrl if the value
// is not a URL with a scheme that can be parsed by this function.
func MustParsePath(path string, options ...option) (string, error) {
	return parsePath(path, true, options)
}

func parsePath(path string, mustParse bool, passedOptions []option) (string, error) {
	var opts options
	for _, o := range passedOptions {
		of := o()
		of(&opts)
	}

	trimmedPath := strings.TrimSpace(path)
	parsed, err := url.Parse(trimmedPath)
	if err != nil {
		err = fmt.Errorf("error parsing url (%q): %w", err.Error(), ErrNotAUrl)
		if opts.noTrimSpaces {
			return path, err
		}
		return trimmedPath, err
	}
	switch parsed.Scheme {
	case "file":
		contents, err := ioutil.ReadFile(strings.TrimPrefix(trimmedPath, "file://"))
		if err != nil {
			return trimmedPath, fmt.Errorf("error reading file at %s: %w", trimmedPath, err)
		}
		if opts.noTrimSpaces {
			return string(contents), nil
		}
		return strings.TrimSpace(string(contents)), nil
	case "env":
		envKey := strings.TrimPrefix(trimmedPath, "env://")
		envVal, ok := os.LookupEnv(envKey)
		if opts.errorOnMissingEnv && !ok {
			return "", fmt.Errorf("environment variable %s unset", envKey)
		}
		if opts.noTrimSpaces {
			return envVal, nil
		}
		return strings.TrimSpace(envVal), nil
	case "string":
		// Meant if there is a need to provide a string literal that is prefixed by one of these URL schemes but want to "escape" it,
		// e.g. "string://env://foo", in order to get the value "env://foo"
		val := strings.TrimPrefix(trimmedPath, "string://")
		if opts.noTrimSpaces {
			return val, nil
		}
		return strings.TrimSpace(val), nil
	default:
		if mustParse {
			return "", ErrNotParsed
		}
		return path, nil
	}
}

// When true, values returned from ParsePath won't have leading/trailing spaces trimmed.
func WithNoTrimSpaces(noTrim bool) option {
	return func() optionFunc {
		return optionFunc(func(o *options) {
			o.noTrimSpaces = noTrim
		})
	}
}

// When true, if an environment variable is unset, an error will be returned rather than the empty string.
func WithErrorOnMissingEnv(errorOnMissingEnv bool) option {
	return func() optionFunc {
		return optionFunc(func(o *options) {
			o.errorOnMissingEnv = errorOnMissingEnv
		})
	}
}
