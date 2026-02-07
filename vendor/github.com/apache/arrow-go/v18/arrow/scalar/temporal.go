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

package scalar

import (
	"fmt"
	"reflect"
	"time"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
)

func temporalToString(s TemporalScalar) string {
	switch s := s.(type) {
	case *Date32:
		return time.Unix(0, 0).UTC().AddDate(0, 0, int(s.Value)).Format("2006-01-02")
	case *Date64:
		days := int(int64(s.Value) / (time.Hour * 24).Milliseconds())
		return time.Unix(0, 0).UTC().AddDate(0, 0, days).Format("2006-01-02")
	case *Duration:
		return fmt.Sprint(time.Duration(s.Value) * s.Unit().Multiplier())
	case *Time32:
		return time.Unix(0, int64(s.Value)*int64(s.Unit().Multiplier())).UTC().Format("15:04:05.999")
	case *Time64:
		return time.Unix(0, int64(s.Value)*int64(s.Unit().Multiplier())).UTC().Format("15:04:05.999999999")
	case *Timestamp:
		return time.Unix(0, int64(s.Value)*int64(s.Unit().Multiplier())).UTC().Format("2006-01-02 15:04:05.999999999")
	}
	return "..."
}

type TemporalScalar interface {
	Scalar
	temporal()
}

type Duration struct {
	scalar
	Value arrow.Duration
}

func (Duration) temporal()                                   {}
func (s *Duration) value() interface{}                       { return s.Value }
func (s *Duration) CastTo(to arrow.DataType) (Scalar, error) { return castTemporal(s, to) }
func (s *Duration) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}

func (s *Duration) equals(rhs Scalar) bool {
	return s.Value == rhs.(*Duration).Value
}

func (s *Duration) Unit() arrow.TimeUnit {
	return s.DataType().(*arrow.TimestampType).Unit
}
func (s *Duration) Data() []byte {
	return (*[arrow.DurationSizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}

func NewDurationScalar(val arrow.Duration, typ arrow.DataType) *Duration {
	return &Duration{scalar{typ, true}, val}
}

type DateScalar interface {
	TemporalScalar
	ToTime() time.Time
	date()
}

type TimeScalar interface {
	TemporalScalar
	Unit() arrow.TimeUnit
	ToTime() time.Time
	time()
}

type IntervalScalar interface {
	TemporalScalar
	interval()
}

const millisecondsInDay = (time.Hour * 24) / time.Millisecond

func castTemporal(from TemporalScalar, to arrow.DataType) (Scalar, error) {
	if arrow.TypeEqual(from.DataType(), to) {
		return from, nil
	}

	if !from.IsValid() {
		return MakeNullScalar(to), nil
	}

	if r, ok := numericMap[to.ID()]; ok {
		return convertToNumeric(reflect.ValueOf(from.value()), r.valueType, r.scalarFunc), nil
	}

	if to.ID() == arrow.STRING {
		return NewStringScalar(temporalToString(from)), nil
	}

	switch s := from.(type) {
	case DateScalar:
		if to.ID() == arrow.TIMESTAMP {
			var newValue int64
			switch s := s.(type) {
			case *Date32:
				newValue = int64(s.Value) * int64(millisecondsInDay)
			case *Date64:
				newValue = int64(s.Value)
			}
			return NewTimestampScalar(arrow.Timestamp(arrow.ConvertTimestampValue(arrow.Millisecond, to.(*arrow.TimestampType).Unit, newValue)), to), nil
		}

		switch s := s.(type) {
		case *Date32:
			if to.ID() == arrow.DATE64 {
				return NewDate64Scalar(arrow.Date64(s.Value) * arrow.Date64(millisecondsInDay)), nil
			}
		case *Date64:
			if to.ID() == arrow.DATE32 {
				return NewDate32Scalar(arrow.Date32(s.Value / arrow.Date64(millisecondsInDay))), nil
			}
		}
	case *Timestamp:
		switch to := to.(type) {
		case *arrow.TimestampType:
			return NewTimestampScalar(arrow.Timestamp(arrow.ConvertTimestampValue(s.Unit(), to.Unit, int64(s.Value))), to), nil
		case *arrow.Date32Type:
			millis := arrow.ConvertTimestampValue(s.Unit(), arrow.Millisecond, int64(s.Value))
			return NewDate32Scalar(arrow.Date32(millis / int64(millisecondsInDay))), nil
		case *arrow.Date64Type:
			millis := arrow.ConvertTimestampValue(s.Unit(), arrow.Millisecond, int64(s.Value))
			return NewDate64Scalar(arrow.Date64(millis - millis%int64(millisecondsInDay))), nil
		}
	case TimeScalar:
		switch to := to.(type) {
		case *arrow.Time32Type:
			return NewTime32Scalar(arrow.Time32(arrow.ConvertTimestampValue(s.Unit(), to.Unit, int64(s.value().(arrow.Time64)))), to), nil
		case *arrow.Time64Type:
			return NewTime64Scalar(arrow.Time64(arrow.ConvertTimestampValue(s.Unit(), to.Unit, int64(s.value().(arrow.Time32)))), to), nil
		}

	case *Duration:
		switch to := to.(type) {
		case *arrow.StringType:

		case *arrow.DurationType:
			return NewDurationScalar(arrow.Duration(arrow.ConvertTimestampValue(s.Unit(), to.Unit, int64(s.Value))), to), nil
		}
	}

	return nil, fmt.Errorf("")
}

type Date32 struct {
	scalar
	Value arrow.Date32
}

func (Date32) temporal()             {}
func (Date32) date()                 {}
func (s *Date32) value() interface{} { return s.Value }
func (s *Date32) Data() []byte {
	return (*[arrow.Date32SizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}
func (s *Date32) equals(rhs Scalar) bool {
	return s.Value == rhs.(*Date32).Value
}
func (s *Date32) CastTo(to arrow.DataType) (Scalar, error) { return castTemporal(s, to) }
func (s *Date32) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}
func (s *Date32) ToTime() time.Time {
	return s.Value.ToTime()
}

func NewDate32Scalar(val arrow.Date32) *Date32 {
	return &Date32{scalar{arrow.FixedWidthTypes.Date32, true}, val}
}

type Date64 struct {
	scalar
	Value arrow.Date64
}

func (Date64) temporal()                                   {}
func (Date64) date()                                       {}
func (s *Date64) value() interface{}                       { return s.Value }
func (s *Date64) CastTo(to arrow.DataType) (Scalar, error) { return castTemporal(s, to) }
func (s *Date64) Data() []byte {
	return (*[arrow.Date64SizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}
func (s *Date64) equals(rhs Scalar) bool {
	return s.Value == rhs.(*Date64).Value
}
func (s *Date64) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}
func (s *Date64) ToTime() time.Time {
	return s.Value.ToTime()
}

func NewDate64Scalar(val arrow.Date64) *Date64 {
	return &Date64{scalar{arrow.FixedWidthTypes.Date64, true}, val}
}

type Time32 struct {
	scalar
	Value arrow.Time32
}

func (Time32) temporal()                                   {}
func (Time32) time()                                       {}
func (s *Time32) value() interface{}                       { return s.Value }
func (s *Time32) CastTo(to arrow.DataType) (Scalar, error) { return castTemporal(s, to) }
func (s *Time32) Unit() arrow.TimeUnit {
	return s.DataType().(*arrow.Time32Type).Unit
}
func (s *Time32) equals(rhs Scalar) bool {
	return s.Value == rhs.(*Time32).Value
}
func (s *Time32) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}

func (s *Time32) Data() []byte {
	return (*[arrow.Time32SizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}

func (s *Time32) ToTime() time.Time {
	return s.Value.ToTime(s.Unit())
}

func NewTime32Scalar(val arrow.Time32, typ arrow.DataType) *Time32 {
	return &Time32{scalar{typ, true}, val}
}

type Time64 struct {
	scalar
	Value arrow.Time64
}

func (Time64) temporal()                                   {}
func (Time64) time()                                       {}
func (s *Time64) value() interface{}                       { return s.Value }
func (s *Time64) CastTo(to arrow.DataType) (Scalar, error) { return castTemporal(s, to) }
func (s *Time64) Unit() arrow.TimeUnit {
	return s.DataType().(*arrow.Time64Type).Unit
}
func (s *Time64) Data() []byte {
	return (*[arrow.Time64SizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}
func (s *Time64) equals(rhs Scalar) bool {
	return s.Value == rhs.(*Time64).Value
}
func (s *Time64) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}

func (s *Time64) ToTime() time.Time {
	return s.Value.ToTime(s.Unit())
}

func NewTime64Scalar(val arrow.Time64, typ arrow.DataType) *Time64 {
	return &Time64{scalar{typ, true}, val}
}

type Timestamp struct {
	scalar
	Value arrow.Timestamp
}

func (Timestamp) temporal()                                   {}
func (Timestamp) time()                                       {}
func (s *Timestamp) value() interface{}                       { return s.Value }
func (s *Timestamp) CastTo(to arrow.DataType) (Scalar, error) { return castTemporal(s, to) }
func (s *Timestamp) Unit() arrow.TimeUnit {
	return s.DataType().(*arrow.TimestampType).Unit
}
func (s *Timestamp) Data() []byte {
	return (*[arrow.TimestampSizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}
func (s *Timestamp) equals(rhs Scalar) bool {
	return s.Value == rhs.(*Timestamp).Value
}
func (s *Timestamp) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}

func (s *Timestamp) ToTime() time.Time {
	return s.Value.ToTime(s.Unit())
}

func NewTimestampScalar(val arrow.Timestamp, typ arrow.DataType) *Timestamp {
	return &Timestamp{scalar{typ, true}, val}
}

type MonthInterval struct {
	scalar
	Value arrow.MonthInterval
}

func (MonthInterval) temporal()             {}
func (MonthInterval) interval()             {}
func (s *MonthInterval) value() interface{} { return s.Value }
func (s *MonthInterval) CastTo(to arrow.DataType) (Scalar, error) {
	if !s.Valid {
		return MakeNullScalar(to), nil
	}

	if !arrow.TypeEqual(s.DataType(), to) {
		return nil, fmt.Errorf("non-null monthinterval scalar cannot be cast to anything other than monthinterval")
	}

	return s, nil
}
func (s *MonthInterval) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}
func (s *MonthInterval) equals(rhs Scalar) bool {
	return s.Value == rhs.(*MonthInterval).Value
}
func (s *MonthInterval) Data() []byte {
	return (*[arrow.MonthIntervalSizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}

func NewMonthIntervalScalar(val arrow.MonthInterval) *MonthInterval {
	return &MonthInterval{scalar{arrow.FixedWidthTypes.MonthInterval, true}, val}
}

type DayTimeInterval struct {
	scalar
	Value arrow.DayTimeInterval
}

func (DayTimeInterval) temporal()             {}
func (DayTimeInterval) interval()             {}
func (s *DayTimeInterval) value() interface{} { return s.Value }
func (s *DayTimeInterval) Data() []byte {
	return (*[arrow.DayTimeIntervalSizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}
func (s *DayTimeInterval) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}

func (s *DayTimeInterval) CastTo(to arrow.DataType) (Scalar, error) {
	if !s.Valid {
		return MakeNullScalar(to), nil
	}

	if !arrow.TypeEqual(s.DataType(), to) {
		return nil, fmt.Errorf("non-null daytimeinterval scalar cannot be cast to anything other than monthinterval")
	}

	return s, nil
}

func (s *DayTimeInterval) equals(rhs Scalar) bool {
	return s.Value == rhs.(*DayTimeInterval).Value
}

func NewDayTimeIntervalScalar(val arrow.DayTimeInterval) *DayTimeInterval {
	return &DayTimeInterval{scalar{arrow.FixedWidthTypes.DayTimeInterval, true}, val}
}

type MonthDayNanoInterval struct {
	scalar
	Value arrow.MonthDayNanoInterval
}

func (MonthDayNanoInterval) temporal()             {}
func (MonthDayNanoInterval) interval()             {}
func (s *MonthDayNanoInterval) value() interface{} { return s.Value }
func (s *MonthDayNanoInterval) Data() []byte {
	return (*[arrow.MonthDayNanoIntervalSizeBytes]byte)(unsafe.Pointer(&s.Value))[:]
}
func (s *MonthDayNanoInterval) String() string {
	if !s.Valid {
		return "null"
	}
	val, err := s.CastTo(arrow.BinaryTypes.String)
	if err != nil {
		return "..."
	}
	return string(val.(*String).Value.Bytes())
}

func (s *MonthDayNanoInterval) CastTo(to arrow.DataType) (Scalar, error) {
	if !s.Valid {
		return MakeNullScalar(to), nil
	}

	if !arrow.TypeEqual(s.DataType(), to) {
		return nil, fmt.Errorf("non-null month_day_nano_interval scalar cannot be cast to anything other than monthinterval")
	}

	return s, nil
}

func (s *MonthDayNanoInterval) equals(rhs Scalar) bool {
	return s.Value == rhs.(*MonthDayNanoInterval).Value
}

func NewMonthDayNanoIntervalScalar(val arrow.MonthDayNanoInterval) *MonthDayNanoInterval {
	return &MonthDayNanoInterval{scalar{arrow.FixedWidthTypes.MonthDayNanoInterval, true}, val}
}

var (
	_ Scalar = (*Date32)(nil)
)
