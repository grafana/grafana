// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Package internal provides internal functionality for the metric package.
package internal // import "go.opentelemetry.io/otel/sdk/metric/internal"

// ReuseSlice returns a zeroed view of slice if its capacity is greater than or
// equal to n. Otherwise, it returns a new []T with capacity equal to n.
func ReuseSlice[T any](slice []T, n int) []T {
	if cap(slice) >= n {
		return slice[:n]
	}
	return make([]T, n)
}
