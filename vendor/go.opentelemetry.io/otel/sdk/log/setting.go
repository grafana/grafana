// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package log // import "go.opentelemetry.io/otel/sdk/log"

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"go.opentelemetry.io/otel"
)

// setting is a configuration setting value.
type setting[T any] struct {
	Value T
	Set   bool
}

// newSetting returns a new [setting] with the value set.
func newSetting[T any](value T) setting[T] {
	return setting[T]{Value: value, Set: true}
}

// resolver returns an updated setting after applying an resolution operation.
type resolver[T any] func(setting[T]) setting[T]

// Resolve returns a resolved version of s.
//
// It will apply all the passed fn in the order provided, chaining together the
// return setting to the next input. The setting s is used as the initial
// argument to the first fn.
//
// Each fn needs to validate if it should apply given the Set state of the
// setting. This will not perform any checks on the set state when chaining
// function.
func (s setting[T]) Resolve(fn ...resolver[T]) setting[T] {
	for _, f := range fn {
		s = f(s)
	}
	return s
}

// clampMax returns a resolver that will ensure a setting value is no greater
// than n. If it is, the value is set to n.
func clampMax[T ~int | ~int64](n T) resolver[T] {
	return func(s setting[T]) setting[T] {
		if s.Value > n {
			s.Value = n
		}
		return s
	}
}

// clearLessThanOne returns a resolver that will clear a setting value and
// change its set state to false if its value is less than 1.
func clearLessThanOne[T ~int | ~int64]() resolver[T] {
	return func(s setting[T]) setting[T] {
		if s.Value < 1 {
			s.Value = 0
			s.Set = false
		}
		return s
	}
}

// getenv returns a resolver that will apply an integer environment variable
// value associated with key to a setting value.
//
// If the input setting to the resolver is set, the environment variable will
// not be applied.
//
// If the environment variable value associated with key is not an integer, an
// error will be sent to the OTel error handler and the setting will not be
// updated.
//
// If the setting value is a [time.Duration] type, the environment variable
// will be interpreted as a duration of milliseconds.
func getenv[T ~int | ~int64](key string) resolver[T] {
	return func(s setting[T]) setting[T] {
		if s.Set {
			// Passed, valid, options have precedence.
			return s
		}

		if v := os.Getenv(key); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil {
				otel.Handle(fmt.Errorf("invalid %s value %s: %w", key, v, err))
			} else {
				switch any(s.Value).(type) {
				case time.Duration:
					// OTel duration envar are in millisecond.
					s.Value = T(time.Duration(n) * time.Millisecond)
				default:
					s.Value = T(n)
				}
				s.Set = true
			}
		}
		return s
	}
}

// fallback returns a resolve that will set a setting value to val if it is not
// already set.
//
// This is usually passed at the end of a resolver chain to ensure a default is
// applied if the setting has not already been set.
func fallback[T any](val T) resolver[T] {
	return func(s setting[T]) setting[T] {
		if !s.Set {
			s.Value = val
			s.Set = true
		}
		return s
	}
}
