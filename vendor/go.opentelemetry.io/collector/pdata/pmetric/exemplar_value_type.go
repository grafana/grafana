// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

// ExemplarValueType specifies the type of Exemplar measurement value.
type ExemplarValueType int32

const (
	// ExemplarValueTypeEmpty means that exemplar value is unset.
	ExemplarValueTypeEmpty ExemplarValueType = iota
	ExemplarValueTypeInt
	ExemplarValueTypeDouble
)

// String returns the string representation of the ExemplarValueType.
func (nt ExemplarValueType) String() string {
	switch nt {
	case ExemplarValueTypeEmpty:
		return "Empty"
	case ExemplarValueTypeInt:
		return "Int"
	case ExemplarValueTypeDouble:
		return "Double"
	}
	return ""
}
