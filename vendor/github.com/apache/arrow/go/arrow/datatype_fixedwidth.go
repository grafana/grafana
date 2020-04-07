// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package arrow

import (
	"fmt"
	"strconv"
)

type BooleanType struct{}

func (t *BooleanType) ID() Type       { return BOOL }
func (t *BooleanType) Name() string   { return "bool" }
func (t *BooleanType) String() string { return "bool" }

// BitWidth returns the number of bits required to store a single element of this data type in memory.
func (t *BooleanType) BitWidth() int { return 1 }

type FixedSizeBinaryType struct {
	ByteWidth int
}

func (*FixedSizeBinaryType) ID() Type        { return FIXED_SIZE_BINARY }
func (*FixedSizeBinaryType) Name() string    { return "fixed_size_binary" }
func (t *FixedSizeBinaryType) BitWidth() int { return 8 * t.ByteWidth }

func (t *FixedSizeBinaryType) String() string {
	return "fixed_size_binary[" + strconv.Itoa(t.ByteWidth) + "]"
}

type (
	Timestamp int64
	Time32    int32
	Time64    int64
	TimeUnit  int
	Date32    int32
	Date64    int64
	Duration  int64
)

const (
	Nanosecond TimeUnit = iota
	Microsecond
	Millisecond
	Second
)

func (u TimeUnit) String() string { return [...]string{"ns", "us", "ms", "s"}[uint(u)&3] }

// TimestampType is encoded as a 64-bit signed integer since the UNIX epoch (2017-01-01T00:00:00Z).
// The zero-value is a nanosecond and time zone neutral. Time zone neutral can be
// considered UTC without having "UTC" as a time zone.
type TimestampType struct {
	Unit     TimeUnit
	TimeZone string
}

func (*TimestampType) ID() Type     { return TIMESTAMP }
func (*TimestampType) Name() string { return "timestamp" }
func (t *TimestampType) String() string {
	switch len(t.TimeZone) {
	case 0:
		return "timestamp[" + t.Unit.String() + "]"
	default:
		return "timestamp[" + t.Unit.String() + ", tz=" + t.TimeZone + "]"
	}
}

// BitWidth returns the number of bits required to store a single element of this data type in memory.
func (*TimestampType) BitWidth() int { return 64 }

// Time32Type is encoded as a 32-bit signed integer, representing either seconds or milliseconds since midnight.
type Time32Type struct {
	Unit TimeUnit
}

func (*Time32Type) ID() Type         { return TIME32 }
func (*Time32Type) Name() string     { return "time32" }
func (*Time32Type) BitWidth() int    { return 32 }
func (t *Time32Type) String() string { return "time32[" + t.Unit.String() + "]" }

// Time64Type is encoded as a 64-bit signed integer, representing either microseconds or nanoseconds since midnight.
type Time64Type struct {
	Unit TimeUnit
}

func (*Time64Type) ID() Type         { return TIME64 }
func (*Time64Type) Name() string     { return "time64" }
func (*Time64Type) BitWidth() int    { return 64 }
func (t *Time64Type) String() string { return "time64[" + t.Unit.String() + "]" }

// DurationType is encoded as a 64-bit signed integer, representing an amount
// of elapsed time without any relation to a calendar artifact.
type DurationType struct {
	Unit TimeUnit
}

func (*DurationType) ID() Type         { return DURATION }
func (*DurationType) Name() string     { return "duration" }
func (*DurationType) BitWidth() int    { return 64 }
func (t *DurationType) String() string { return "duration[" + t.Unit.String() + "]" }

// Float16Type represents a floating point value encoded with a 16-bit precision.
type Float16Type struct{}

func (t *Float16Type) ID() Type       { return FLOAT16 }
func (t *Float16Type) Name() string   { return "float16" }
func (t *Float16Type) String() string { return "float16" }

// BitWidth returns the number of bits required to store a single element of this data type in memory.
func (t *Float16Type) BitWidth() int { return 16 }

// Decimal128Type represents a fixed-size 128-bit decimal type.
type Decimal128Type struct {
	Precision int32
	Scale     int32
}

func (*Decimal128Type) ID() Type      { return DECIMAL }
func (*Decimal128Type) Name() string  { return "decimal" }
func (*Decimal128Type) BitWidth() int { return 16 }
func (t *Decimal128Type) String() string {
	return fmt.Sprintf("%s(%d, %d)", t.Name(), t.Precision, t.Scale)
}

// MonthInterval represents a number of months.
type MonthInterval int32

// MonthIntervalType is encoded as a 32-bit signed integer,
// representing a number of months.
type MonthIntervalType struct{}

func (*MonthIntervalType) ID() Type       { return INTERVAL }
func (*MonthIntervalType) Name() string   { return "month_interval" }
func (*MonthIntervalType) String() string { return "month_interval" }

// BitWidth returns the number of bits required to store a single element of this data type in memory.
func (t *MonthIntervalType) BitWidth() int { return 32 }

// DayTimeInterval represents a number of days and milliseconds (fraction of day).
type DayTimeInterval struct {
	Days         int32 `json:"days"`
	Milliseconds int32 `json:"milliseconds"`
}

// DayTimeIntervalType is encoded as a pair of 32-bit signed integer,
// representing a number of days and milliseconds (fraction of day).
type DayTimeIntervalType struct{}

func (*DayTimeIntervalType) ID() Type       { return INTERVAL }
func (*DayTimeIntervalType) Name() string   { return "day_time_interval" }
func (*DayTimeIntervalType) String() string { return "day_time_interval" }

// BitWidth returns the number of bits required to store a single element of this data type in memory.
func (t *DayTimeIntervalType) BitWidth() int { return 64 }

var (
	FixedWidthTypes = struct {
		Boolean         FixedWidthDataType
		Date32          FixedWidthDataType
		Date64          FixedWidthDataType
		DayTimeInterval FixedWidthDataType
		Duration_s      FixedWidthDataType
		Duration_ms     FixedWidthDataType
		Duration_us     FixedWidthDataType
		Duration_ns     FixedWidthDataType
		Float16         FixedWidthDataType
		MonthInterval   FixedWidthDataType
		Time32s         FixedWidthDataType
		Time32ms        FixedWidthDataType
		Time64us        FixedWidthDataType
		Time64ns        FixedWidthDataType
		Timestamp_s     FixedWidthDataType
		Timestamp_ms    FixedWidthDataType
		Timestamp_us    FixedWidthDataType
		Timestamp_ns    FixedWidthDataType
	}{
		Boolean:         &BooleanType{},
		Date32:          &Date32Type{},
		Date64:          &Date64Type{},
		DayTimeInterval: &DayTimeIntervalType{},
		Duration_s:      &DurationType{Unit: Second},
		Duration_ms:     &DurationType{Unit: Millisecond},
		Duration_us:     &DurationType{Unit: Microsecond},
		Duration_ns:     &DurationType{Unit: Nanosecond},
		Float16:         &Float16Type{},
		MonthInterval:   &MonthIntervalType{},
		Time32s:         &Time32Type{Unit: Second},
		Time32ms:        &Time32Type{Unit: Millisecond},
		Time64us:        &Time64Type{Unit: Microsecond},
		Time64ns:        &Time64Type{Unit: Nanosecond},
		Timestamp_s:     &TimestampType{Unit: Second, TimeZone: "UTC"},
		Timestamp_ms:    &TimestampType{Unit: Millisecond, TimeZone: "UTC"},
		Timestamp_us:    &TimestampType{Unit: Microsecond, TimeZone: "UTC"},
		Timestamp_ns:    &TimestampType{Unit: Nanosecond, TimeZone: "UTC"},
	}

	_ FixedWidthDataType = (*FixedSizeBinaryType)(nil)
)
