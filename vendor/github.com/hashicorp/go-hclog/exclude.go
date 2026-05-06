// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MIT

package hclog

import (
	"regexp"
	"strings"
)

// ExcludeByMessage provides a simple way to build a list of log messages that
// can be queried and matched. This is meant to be used with the Exclude
// option on Options to suppress log messages. This does not hold any mutexs
// within itself, so normal usage would be to Add entries at setup and none after
// Exclude is going to be called. Exclude is called with a mutex held within
// the Logger, so that doesn't need to use a mutex. Example usage:
//
//	f := new(ExcludeByMessage)
//	f.Add("Noisy log message text")
//	appLogger.Exclude = f.Exclude
type ExcludeByMessage struct {
	messages map[string]struct{}
}

// Add a message to be filtered. Do not call this after Exclude is to be called
// due to concurrency issues.
func (f *ExcludeByMessage) Add(msg string) {
	if f.messages == nil {
		f.messages = make(map[string]struct{})
	}

	f.messages[msg] = struct{}{}
}

// Return true if the given message should be included
func (f *ExcludeByMessage) Exclude(level Level, msg string, args ...interface{}) bool {
	_, ok := f.messages[msg]
	return ok
}

// ExcludeByPrefix is a simple type to match a message string that has a common prefix.
type ExcludeByPrefix string

// Matches an message that starts with the prefix.
func (p ExcludeByPrefix) Exclude(level Level, msg string, args ...interface{}) bool {
	return strings.HasPrefix(msg, string(p))
}

// ExcludeByRegexp takes a regexp and uses it to match a log message string. If it matches
// the log entry is excluded.
type ExcludeByRegexp struct {
	Regexp *regexp.Regexp
}

// Exclude the log message if the message string matches the regexp
func (e ExcludeByRegexp) Exclude(level Level, msg string, args ...interface{}) bool {
	return e.Regexp.MatchString(msg)
}

// ExcludeFuncs is a slice of functions that will called to see if a log entry
// should be filtered or not. It stops calling functions once at least one returns
// true.
type ExcludeFuncs []func(level Level, msg string, args ...interface{}) bool

// Calls each function until one of them returns true
func (ff ExcludeFuncs) Exclude(level Level, msg string, args ...interface{}) bool {
	for _, f := range ff {
		if f(level, msg, args...) {
			return true
		}
	}

	return false
}
