// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

// NumberDataPointValueType specifies the type of NumberDataPoint value.
type NumberDataPointValueType int32

const (
	// NumberDataPointValueTypeEmpty means that data point value is unset.
	NumberDataPointValueTypeEmpty NumberDataPointValueType = iota
	NumberDataPointValueTypeInt
	NumberDataPointValueTypeDouble
)

// String returns the string representation of the NumberDataPointValueType.
func (nt NumberDataPointValueType) String() string {
	switch nt {
	case NumberDataPointValueTypeEmpty:
		return "Empty"
	case NumberDataPointValueTypeInt:
		return "Int"
	case NumberDataPointValueTypeDouble:
		return "Double"
	}
	return ""
}
