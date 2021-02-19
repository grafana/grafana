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
)

const (
	timeFormatString = "2006-01-02T15:04:05.999Z07:00"
)

var defaultTimeCodec = NewTimeCodec()

// TimeCodec is the Codec used for time.Time values.
type TimeCodec struct {
	UseLocalTimeZone bool
}

var _ ValueCodec = &TimeCodec{}

// NewTimeCodec returns a TimeCodec with options opts.
func NewTimeCodec(opts ...*bsonoptions.TimeCodecOptions) *TimeCodec {
	timeOpt := bsonoptions.MergeTimeCodecOptions(opts...)

	codec := TimeCodec{}
	if timeOpt.UseLocalTimeZone != nil {
		codec.UseLocalTimeZone = *timeOpt.UseLocalTimeZone
	}
	return &codec
}

// DecodeValue is the ValueDecoderFunc for time.Time.
func (tc *TimeCodec) DecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tTime {
		return ValueDecoderError{Name: "TimeDecodeValue", Types: []reflect.Type{tTime}, Received: val}
	}

	var timeVal time.Time
	switch vrType := vr.Type(); vrType {
	case bsontype.DateTime:
		dt, err := vr.ReadDateTime()
		if err != nil {
			return err
		}
		timeVal = time.Unix(dt/1000, dt%1000*1000000)
	case bsontype.String:
		// assume strings are in the isoTimeFormat
		timeStr, err := vr.ReadString()
		if err != nil {
			return err
		}
		timeVal, err = time.Parse(timeFormatString, timeStr)
		if err != nil {
			return err
		}
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return err
		}
		timeVal = time.Unix(i64/1000, i64%1000*1000000)
	case bsontype.Timestamp:
		t, _, err := vr.ReadTimestamp()
		if err != nil {
			return err
		}
		timeVal = time.Unix(int64(t), 0)
	case bsontype.Null:
		if err := vr.ReadNull(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into a time.Time", vrType)
	}

	if !tc.UseLocalTimeZone {
		timeVal = timeVal.UTC()
	}
	val.Set(reflect.ValueOf(timeVal))
	return nil
}

// EncodeValue is the ValueEncoderFunc for time.TIme.
func (tc *TimeCodec) EncodeValue(ec EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	if !val.IsValid() || val.Type() != tTime {
		return ValueEncoderError{Name: "TimeEncodeValue", Types: []reflect.Type{tTime}, Received: val}
	}
	tt := val.Interface().(time.Time)
	return vw.WriteDateTime(tt.Unix()*1000 + int64(tt.Nanosecond()/1e6))
}
