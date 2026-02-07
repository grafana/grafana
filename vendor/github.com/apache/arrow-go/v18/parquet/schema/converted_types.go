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

package schema

import (
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
)

// ConvertedType corresponds to the ConvertedType in the parquet.Thrift,
// with added values of None and NA for handling when these values are not
// set in the metadata
type ConvertedType format.ConvertedType

var (
	// ConvertedTypes is a struct containing the constants for the types
	// to make it easy to reference them while making it clear what they are
	ConvertedTypes = struct {
		None            ConvertedType
		UTF8            ConvertedType
		Map             ConvertedType
		MapKeyValue     ConvertedType
		List            ConvertedType
		Enum            ConvertedType
		Decimal         ConvertedType
		Date            ConvertedType
		TimeMillis      ConvertedType
		TimeMicros      ConvertedType
		TimestampMillis ConvertedType
		TimestampMicros ConvertedType
		Uint8           ConvertedType
		Uint16          ConvertedType
		Uint32          ConvertedType
		Uint64          ConvertedType
		Int8            ConvertedType
		Int16           ConvertedType
		Int32           ConvertedType
		Int64           ConvertedType
		JSON            ConvertedType
		BSON            ConvertedType
		Interval        ConvertedType
		NA              ConvertedType
	}{
		None:            -1, // thrift enum starts at 0, so we know this will not be used
		UTF8:            ConvertedType(format.ConvertedType_UTF8),
		Map:             ConvertedType(format.ConvertedType_MAP),
		MapKeyValue:     ConvertedType(format.ConvertedType_MAP_KEY_VALUE),
		List:            ConvertedType(format.ConvertedType_LIST),
		Enum:            ConvertedType(format.ConvertedType_ENUM),
		Decimal:         ConvertedType(format.ConvertedType_DECIMAL),
		Date:            ConvertedType(format.ConvertedType_DATE),
		TimeMillis:      ConvertedType(format.ConvertedType_TIME_MILLIS),
		TimeMicros:      ConvertedType(format.ConvertedType_TIME_MICROS),
		TimestampMillis: ConvertedType(format.ConvertedType_TIMESTAMP_MILLIS),
		TimestampMicros: ConvertedType(format.ConvertedType_TIMESTAMP_MICROS),
		Uint8:           ConvertedType(format.ConvertedType_UINT_8),
		Uint16:          ConvertedType(format.ConvertedType_UINT_16),
		Uint32:          ConvertedType(format.ConvertedType_UINT_32),
		Uint64:          ConvertedType(format.ConvertedType_UINT_64),
		Int8:            ConvertedType(format.ConvertedType_INT_8),
		Int16:           ConvertedType(format.ConvertedType_INT_16),
		Int32:           ConvertedType(format.ConvertedType_INT_32),
		Int64:           ConvertedType(format.ConvertedType_INT_64),
		JSON:            ConvertedType(format.ConvertedType_JSON),
		BSON:            ConvertedType(format.ConvertedType_BSON),
		Interval:        ConvertedType(format.ConvertedType_INTERVAL),
		NA:              24, // should always be the last values after Interval
	}
)

func (p ConvertedType) String() string {
	switch p {
	case ConvertedTypes.None:
		return "NONE"
	case ConvertedTypes.NA:
		return "UNKNOWN"
	default:
		return format.ConvertedType(p).String()
	}
}

// ToLogicalType returns the correct LogicalType for the given ConvertedType, using the decimal
// metadata provided to define the precision/scale if necessary
func (p ConvertedType) ToLogicalType(convertedDecimal DecimalMetadata) LogicalType {
	switch p {
	case ConvertedTypes.UTF8:
		return StringLogicalType{}
	case ConvertedTypes.Map, ConvertedTypes.MapKeyValue:
		return MapLogicalType{}
	case ConvertedTypes.List:
		return ListLogicalType{}
	case ConvertedTypes.Enum:
		return EnumLogicalType{}
	case ConvertedTypes.Decimal:
		return NewDecimalLogicalType(convertedDecimal.Precision, convertedDecimal.Scale)
	case ConvertedTypes.Date:
		return DateLogicalType{}
	case ConvertedTypes.TimeMillis:
		return NewTimeLogicalType(true /* adjustedToUTC */, TimeUnitMillis)
	case ConvertedTypes.TimeMicros:
		return NewTimeLogicalType(true /* adjustedToUTC */, TimeUnitMicros)
	case ConvertedTypes.TimestampMillis:
		return NewTimestampLogicalTypeWithOpts(WithTSIsAdjustedToUTC(), WithTSTimeUnitType(TimeUnitMillis), WithTSFromConverted())
	case ConvertedTypes.TimestampMicros:
		return NewTimestampLogicalTypeWithOpts(WithTSIsAdjustedToUTC(), WithTSTimeUnitType(TimeUnitMicros), WithTSFromConverted())
	case ConvertedTypes.Interval:
		return IntervalLogicalType{}
	case ConvertedTypes.Int8:
		return NewIntLogicalType(8 /* bitWidth */, true /* signed */)
	case ConvertedTypes.Int16:
		return NewIntLogicalType(16 /* bitWidth */, true /* signed */)
	case ConvertedTypes.Int32:
		return NewIntLogicalType(32 /* bitWidth */, true /* signed */)
	case ConvertedTypes.Int64:
		return NewIntLogicalType(64 /* bitWidth */, true /* signed */)
	case ConvertedTypes.Uint8:
		return NewIntLogicalType(8 /* bitWidth */, false /* signed */)
	case ConvertedTypes.Uint16:
		return NewIntLogicalType(16 /* bitWidth */, false /* signed */)
	case ConvertedTypes.Uint32:
		return NewIntLogicalType(32 /* bitWidth */, false /* signed */)
	case ConvertedTypes.Uint64:
		return NewIntLogicalType(64 /* bitWidth */, false /* signed */)
	case ConvertedTypes.JSON:
		return JSONLogicalType{}
	case ConvertedTypes.BSON:
		return BSONLogicalType{}
	case ConvertedTypes.None:
		return NoLogicalType{}
	case ConvertedTypes.NA:
		fallthrough
	default:
		return UnknownLogicalType{}
	}
}

// GetSortOrder defaults to the sort order based on the physical type if convert
// is ConvertedTypes.None, otherwise determines the sort order by the converted type.
func GetSortOrder(convert ConvertedType, primitive format.Type) SortOrder {
	if convert == ConvertedTypes.None {
		return DefaultSortOrder(primitive)
	}
	switch convert {
	case ConvertedTypes.Int8,
		ConvertedTypes.Int16,
		ConvertedTypes.Int32,
		ConvertedTypes.Int64,
		ConvertedTypes.Date,
		ConvertedTypes.TimeMicros,
		ConvertedTypes.TimeMillis,
		ConvertedTypes.TimestampMicros,
		ConvertedTypes.TimestampMillis,
		ConvertedTypes.Decimal:
		return SortSIGNED
	case ConvertedTypes.Uint8,
		ConvertedTypes.Uint16,
		ConvertedTypes.Uint32,
		ConvertedTypes.Uint64,
		ConvertedTypes.Enum,
		ConvertedTypes.UTF8,
		ConvertedTypes.BSON,
		ConvertedTypes.JSON:
		return SortUNSIGNED
	case ConvertedTypes.List,
		ConvertedTypes.Map,
		ConvertedTypes.MapKeyValue,
		ConvertedTypes.Interval,
		ConvertedTypes.None,
		ConvertedTypes.NA:
		return SortUNKNOWN
	default:
		return SortUNKNOWN
	}
}
