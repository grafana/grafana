// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"fmt"
	"reflect"
	"time"

	"go.mongodb.org/mongo-driver/bson/bsonoptions"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	timeFormatString = "2006-01-02T15:04:05.999Z07:00"
)

// TimeCodec is the Codec used for time.Time values.
//
// Deprecated: TimeCodec will not be directly configurable in Go Driver 2.0.
// To configure the time.Time encode and decode behavior, use the configuration
// methods on a [go.mongodb.org/mongo-driver/bson.Encoder] or
// [go.mongodb.org/mongo-driver/bson.Decoder]. To configure the time.Time encode
// and decode behavior for a mongo.Client, use
// [go.mongodb.org/mongo-driver/mongo/options.ClientOptions.SetBSONOptions].
//
// For example, to configure a mongo.Client to ..., use:
//
//	opt := options.Client().SetBSONOptions(&options.BSONOptions{
//	    UseLocalTimeZone: true,
//	})
//
// See the deprecation notice for each field in TimeCodec for the corresponding
// settings.
type TimeCodec struct {
	// UseLocalTimeZone specifies if we should decode into the local time zone. Defaults to false.
	//
	// Deprecated: Use bson.Decoder.UseLocalTimeZone or options.BSONOptions.UseLocalTimeZone
	// instead.
	UseLocalTimeZone bool
}

var (
	defaultTimeCodec = NewTimeCodec()

	// Assert that defaultTimeCodec satisfies the typeDecoder interface, which allows it to be used
	// by collection type decoders (e.g. map, slice, etc) to set individual values in a collection.
	_ typeDecoder = defaultTimeCodec
)

// NewTimeCodec returns a TimeCodec with options opts.
//
// Deprecated: NewTimeCodec will not be available in Go Driver 2.0. See
// [TimeCodec] for more details.
func NewTimeCodec(opts ...*bsonoptions.TimeCodecOptions) *TimeCodec {
	timeOpt := bsonoptions.MergeTimeCodecOptions(opts...)

	codec := TimeCodec{}
	if timeOpt.UseLocalTimeZone != nil {
		codec.UseLocalTimeZone = *timeOpt.UseLocalTimeZone
	}
	return &codec
}

func (tc *TimeCodec) decodeType(dc DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tTime {
		return emptyValue, ValueDecoderError{
			Name:     "TimeDecodeValue",
			Types:    []reflect.Type{tTime},
			Received: reflect.Zero(t),
		}
	}

	var timeVal time.Time
	switch vrType := vr.Type(); vrType {
	case bsontype.DateTime:
		dt, err := vr.ReadDateTime()
		if err != nil {
			return emptyValue, err
		}
		timeVal = time.Unix(dt/1000, dt%1000*1000000)
	case bsontype.String:
		// assume strings are in the isoTimeFormat
		timeStr, err := vr.ReadString()
		if err != nil {
			return emptyValue, err
		}
		timeVal, err = time.Parse(timeFormatString, timeStr)
		if err != nil {
			return emptyValue, err
		}
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return emptyValue, err
		}
		timeVal = time.Unix(i64/1000, i64%1000*1000000)
	case bsontype.Timestamp:
		t, _, err := vr.ReadTimestamp()
		if err != nil {
			return emptyValue, err
		}
		timeVal = time.Unix(int64(t), 0)
	case bsontype.Null:
		if err := vr.ReadNull(); err != nil {
			return emptyValue, err
		}
	case bsontype.Undefined:
		if err := vr.ReadUndefined(); err != nil {
			return emptyValue, err
		}
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a time.Time", vrType)
	}

	if !tc.UseLocalTimeZone && !dc.useLocalTimeZone {
		timeVal = timeVal.UTC()
	}
	return reflect.ValueOf(timeVal), nil
}

// DecodeValue is the ValueDecoderFunc for time.Time.
func (tc *TimeCodec) DecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tTime {
		return ValueDecoderError{Name: "TimeDecodeValue", Types: []reflect.Type{tTime}, Received: val}
	}

	elem, err := tc.decodeType(dc, vr, tTime)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

// EncodeValue is the ValueEncoderFunc for time.TIme.
func (tc *TimeCodec) EncodeValue(_ EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	if !val.IsValid() || val.Type() != tTime {
		return ValueEncoderError{Name: "TimeEncodeValue", Types: []reflect.Type{tTime}, Received: val}
	}
	tt := val.Interface().(time.Time)
	dt := primitive.NewDateTimeFromTime(tt)
	return vw.WriteDateTime(int64(dt))
}
